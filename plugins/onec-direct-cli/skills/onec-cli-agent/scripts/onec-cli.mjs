#!/usr/bin/env node
import fs from 'node:fs'
import http from 'node:http'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const skillDir = path.resolve(scriptDir, '..')
const ALLOWED_TOOLS = new Set(['list_metadata_objects', 'get_metadata_structure', 'execute_query'])
let rpcId = 0

const usage = () => {
  console.error([
    'Usage:',
    '  onec-cli.mjs health [--raw]',
    '  onec-cli.mjs tools [--raw]',
    '  onec-cli.mjs metadata-list --type TYPE [--name-mask TEXT] [--max-items N] [--raw]',
    '  onec-cli.mjs metadata-get --type TYPE --name NAME [--sections a,b] [--raw]',
    '  onec-cli.mjs query (--text QUERY | --file PATH | --stdin) [--params-json JSON | --params-file PATH] [--max-rows N] [--dry-run] [--raw]',
    '  onec-cli.mjs self-test',
    '',
    'Required: ONEC_HTTP_SERVICE_URL or ONEC_HTTP_BASE_URL',
    'Optional: ONEC_HTTP_SERVICE_ROOT, ONEC_HTTP_USERNAME, ONEC_HTTP_PASSWORD, ONEC_HTTP_AUTHORIZATION,',
    '          ONEC_HTTP_TIMEOUT_MS, ONEC_HTTP_UNLOCK_CODE, ONEC_HTTP_ENV_FILE'
  ].join('\n'))
}

const parseDotenv = (content) => {
  const result = {}
  for (const sourceLine of content.split(/\r?\n/)) {
    const line = sourceLine.trim().replace(/^export\s+/, '')
    if (!line || line.startsWith('#')) continue
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/)
    if (!match) continue
    let value = match[2].trim()
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1)
    result[match[1]] = value
  }
  return result
}

const loadEnv = () => {
  const explicit = process.env.ONEC_HTTP_ENV_FILE
  const candidates = explicit
    ? [path.resolve(explicit)]
    : [
        path.resolve(process.cwd(), '.env'),
        path.join(skillDir, '.env'),
        path.join(os.homedir(), '.config', 'hobbyka', 'onec-direct.env')
      ]
  for (const envPath of [...new Set(candidates)]) {
    if (!fs.existsSync(envPath)) continue
    for (const [key, value] of Object.entries(parseDotenv(fs.readFileSync(envPath, 'utf8')))) {
      if (process.env[key] == null) process.env[key] = value
    }
  }
}

const env = (name, fallback = '') => {
  const value = process.env[name]
  return value == null || String(value).trim() === '' ? fallback : String(value).trim()
}

const takeValue = (args, index, option) => {
  const value = args[index + 1]
  if (value == null || value.startsWith('--')) throw new Error(`${option} requires a value`)
  return value
}

const parseArgs = (argv) => {
  const options = { command: argv[2] || 'help', raw: false, stdin: false, dryRun: false }
  if (['-h', '--help'].includes(options.command)) options.command = 'help'
  const args = argv.slice(3)
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]
    if (arg === '--text') options.text = takeValue(args, index++, arg)
    else if (arg === '--file') options.file = takeValue(args, index++, arg)
    else if (arg === '--type') options.type = takeValue(args, index++, arg)
    else if (arg === '--name') options.name = takeValue(args, index++, arg)
    else if (arg === '--name-mask') options.nameMask = takeValue(args, index++, arg)
    else if (arg === '--max-items') options.maxItems = takeValue(args, index++, arg)
    else if (arg === '--max-rows') options.maxRows = takeValue(args, index++, arg)
    else if (arg === '--sections') options.sections = takeValue(args, index++, arg)
    else if (arg === '--params-json') options.paramsJson = takeValue(args, index++, arg)
    else if (arg === '--params-file') options.paramsFile = takeValue(args, index++, arg)
    else if (arg === '--stdin') options.stdin = true
    else if (arg === '--dry-run') options.dryRun = true
    else if (arg === '--raw') options.raw = true
    else if (['-h', '--help'].includes(arg)) options.command = 'help'
    else throw new Error(`Unknown argument: ${arg}`)
  }
  return options
}

const isPrivateHost = (hostname) => {
  if (['localhost', '127.0.0.1', '::1'].includes(hostname) || hostname.endsWith('.local')) return true
  const parts = hostname.split('.').map(Number)
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return false
  return parts[0] === 10 || (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) || (parts[0] === 192 && parts[1] === 168)
}

const config = () => {
  const explicitServiceUrl = env('ONEC_HTTP_SERVICE_URL')
  const baseUrl = env('ONEC_HTTP_BASE_URL')
  if (!explicitServiceUrl && !baseUrl) throw new Error('ONEC_HTTP_SERVICE_URL or ONEC_HTTP_BASE_URL is required')
  const serviceRoot = env('ONEC_HTTP_SERVICE_ROOT', 'mcp').replace(/^\/+|\/+$/g, '')
  const normalizedBase = (explicitServiceUrl || baseUrl).replace(/\/+$/, '')
  const serviceUrl = explicitServiceUrl ? normalizedBase : (/\/hs\/[^/]+$/i.test(normalizedBase) ? normalizedBase : `${normalizedBase}/hs/${serviceRoot}`)
  const parsedUrl = new URL(serviceUrl)
  if (parsedUrl.username || parsedUrl.password) throw new Error('Do not embed 1C credentials in the URL; use ONEC_HTTP_USERNAME and ONEC_HTTP_PASSWORD')
  const allowInsecure = env('ONEC_HTTP_ALLOW_INSECURE') === '1'
  if (parsedUrl.protocol !== 'https:' && !(parsedUrl.protocol === 'http:' && (isPrivateHost(parsedUrl.hostname) || allowInsecure))) {
    throw new Error('Remote 1C HTTP requires HTTPS; set ONEC_HTTP_ALLOW_INSECURE=1 only for a trusted internal host')
  }
  const authorization = env('ONEC_HTTP_AUTHORIZATION')
  const username = env('ONEC_HTTP_USERNAME')
  const password = process.env.ONEC_HTTP_PASSWORD == null ? '' : String(process.env.ONEC_HTTP_PASSWORD)
  const timeoutMs = Number(env('ONEC_HTTP_TIMEOUT_MS', '60000'))
  const maxResponseBytes = Number(env('ONEC_HTTP_MAX_RESPONSE_BYTES', '10485760'))
  return {
    serviceUrl,
    authorization: authorization || (username ? `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}` : ''),
    timeoutMs: Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 60000,
    maxResponseBytes: Number.isFinite(maxResponseBytes) && maxResponseBytes > 0 ? maxResponseBytes : 10485760,
    unlockCode: env('ONEC_HTTP_UNLOCK_CODE')
  }
}

const endpoint = (cfg, suffix) => {
  const url = new URL(`${cfg.serviceUrl}/${suffix.replace(/^\/+/, '')}`)
  if (cfg.unlockCode) url.searchParams.set('uc', cfg.unlockCode)
  return url
}

const safeDetail = (text) => String(text || '')
  .replace(/\s+/g, ' ')
  .replace(/Basic\s+[A-Za-z0-9+/=]+/gi, 'Basic [redacted]')
  .slice(0, 240)

const readLimited = async (response, limit) => {
  if (!response.body) return ''
  const reader = response.body.getReader()
  const chunks = []
  let bytes = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    bytes += value.byteLength
    if (bytes > limit) {
      await reader.cancel()
      throw new Error(`1C response exceeds ${limit} bytes`)
    }
    chunks.push(value)
  }
  const merged = new Uint8Array(bytes)
  let offset = 0
  for (const chunk of chunks) { merged.set(chunk, offset); offset += chunk.byteLength }
  return new TextDecoder().decode(merged).replace(/^\uFEFF/, '')
}

const requestJson = async (cfg, method, suffix, body) => {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), cfg.timeoutMs)
  try {
    const response = await fetch(endpoint(cfg, suffix), {
      method,
      headers: {
        Accept: 'application/json',
        ...(cfg.authorization ? { Authorization: cfg.authorization } : {}),
        ...(body ? { 'Content-Type': 'application/json' } : {})
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
      redirect: 'error'
    })
    const text = await readLimited(response, cfg.maxResponseBytes)
    if (!response.ok) throw new Error(`1C HTTP returned ${response.status}${text ? `: ${safeDetail(text)}` : ''}`)
    try { return text ? JSON.parse(text) : null } catch { throw new Error(`1C returned invalid JSON: ${safeDetail(text)}`) }
  } catch (error) {
    if (error?.name === 'AbortError') throw new Error(`1C HTTP timed out after ${cfg.timeoutMs} ms`)
    if (error?.cause?.code) throw new Error(`1C HTTP connection failed: ${error.cause.code}`)
    throw error
  } finally {
    clearTimeout(timer)
  }
}

const rpc = async (cfg, method, params = {}) => {
  const request = { jsonrpc: '2.0', id: ++rpcId, method, params }
  const response = await requestJson(cfg, 'POST', 'rpc', request)
  if (response?.error) throw new Error(`1C RPC ${response.error.code ?? 'error'}: ${safeDetail(response.error.message)}`)
  return { request, response, result: response?.result ?? {} }
}

const textContent = (result) => (Array.isArray(result?.content) ? result.content : [])
  .filter((item) => item?.type === 'text' && typeof item.text === 'string')
  .map((item) => item.text)

const normalizeToolResult = (tool, result, raw) => {
  if (result?.isError) throw new Error(`1C tool ${tool} failed: ${safeDetail(textContent(result).join('\n'))}`)
  if (raw) return result
  const texts = textContent(result)
  if (texts.length === 1) {
    try { return { ok: true, tool, data: JSON.parse(texts[0]) } } catch { return { ok: true, tool, data: texts[0] } }
  }
  return { ok: true, tool, data: texts }
}

const callTool = async (cfg, tool, args, raw = false) => {
  if (!ALLOWED_TOOLS.has(tool)) throw new Error(`Tool ${tool} is not allowed by the read-only CLI`)
  const { result } = await rpc(cfg, 'tools/call', { name: tool, arguments: args })
  return normalizeToolResult(tool, result, raw)
}

const positiveInt = (value, fallback, option, maximum) => {
  const number = value == null ? fallback : Number(value)
  if (!Number.isInteger(number) || number < 1 || number > maximum) throw new Error(`${option} must be an integer from 1 to ${maximum}`)
  return number
}

const readStdin = async () => {
  let text = ''
  for await (const chunk of process.stdin) text += chunk
  return text
}

const queryText = async (options) => {
  const count = [Boolean(options.text), Boolean(options.file), options.stdin].filter(Boolean).length
  if (count !== 1) throw new Error('query requires exactly one of --text, --file, or --stdin')
  const text = options.file ? fs.readFileSync(path.resolve(options.file), 'utf8') : (options.stdin ? await readStdin() : options.text)
  if (!String(text || '').trim()) throw new Error('Query is empty')
  return String(text).trim()
}

const queryParams = (options) => {
  if (options.paramsJson && options.paramsFile) throw new Error('Use only one of --params-json or --params-file')
  if (!options.paramsJson && !options.paramsFile) return undefined
  const source = options.paramsFile ? fs.readFileSync(path.resolve(options.paramsFile), 'utf8') : options.paramsJson
  let value
  try { value = JSON.parse(source) } catch { throw new Error('Query params must be valid JSON') }
  if (!value || Array.isArray(value) || typeof value !== 'object') throw new Error('Query params must be a JSON object')
  for (const [key, item] of Object.entries(value)) {
    if (!/^[A-Za-zА-Яа-яЁё_][A-Za-zА-Яа-яЁё0-9_]*$/u.test(key)) throw new Error(`Invalid 1C query parameter name: ${key}`)
    if (!['string', 'number', 'boolean'].includes(typeof item)) throw new Error(`Unsupported value type for 1C query parameter: ${key}`)
  }
  return value
}

const validateReadOnlyQuery = (query) => {
  const withoutComments = query.replace(/^\s*(?:\/\/|--)?.*$/gm, (line) => (/^\s*(?:\/\/|--)/.test(line) ? '' : line)).trim()
  if (!/^ВЫБРАТЬ(?:\s|$)/iu.test(withoutComments)) throw new Error('Only 1C queries beginning with ВЫБРАТЬ are allowed')
  if (/(?:^|[^A-ZА-ЯЁ0-9_])ПЕРВЫЕ(?:$|[^A-ZА-ЯЁ0-9_])/u.test(withoutComments.toLocaleUpperCase('ru-RU'))) {
    throw new Error('Do not use ПЕРВЫЕ in query text; use --max-rows so 1C applies the limit safely')
  }
  const blocked = ['INSERT', 'UPDATE', 'DELETE', 'DROP', 'ALTER', 'CREATE', 'EXECUTE', 'CALL', 'ВСТАВИТЬ', 'ОБНОВИТЬ', 'УДАЛИТЬ', 'ИЗМЕНИТЬ', 'СОЗДАТЬ', 'ВЫПОЛНИТЬ', 'ЗАПИСАТЬ', 'ПРОВЕСТИ']
  const upper = withoutComments.toLocaleUpperCase('ru-RU')
  for (const word of blocked) {
    const pattern = new RegExp(`(?:^|[^A-ZА-ЯЁ0-9_])${word}(?:$|[^A-ZА-ЯЁ0-9_])`, 'u')
    if (pattern.test(upper)) throw new Error(`Blocked non-read-only keyword: ${word}`)
  }
  return withoutComments
}

const main = async () => {
  loadEnv()
  const options = parseArgs(process.argv)
  if (options.command === 'help') return usage()
  if (options.command === 'self-test') return selfTest()
  const cfg = config()

  if (options.command === 'health') {
    const data = await requestJson(cfg, 'GET', 'health')
    if (data?.status !== 'ok') throw new Error(`1C health check returned unexpected data: ${safeDetail(JSON.stringify(data))}`)
    return print({ ok: true, service: '1C HTTP', status: 'ok' })
  }

  if (options.command === 'tools') {
    const { result } = await rpc(cfg, 'tools/list')
    const tools = Array.isArray(result?.tools) ? result.tools : []
    return print(options.raw ? result : { ok: true, tools: tools.map(({ name, description, inputSchema }) => ({ name, description, inputSchema })) })
  }

  if (options.command === 'metadata-list') {
    if (!options.type) throw new Error('metadata-list requires --type')
    return print(await callTool(cfg, 'list_metadata_objects', {
      metaType: options.type,
      ...(options.nameMask ? { nameMask: options.nameMask } : {}),
      maxItems: positiveInt(options.maxItems, 100, '--max-items', 1000)
    }, options.raw))
  }

  if (options.command === 'metadata-get') {
    if (!options.type || !options.name) throw new Error('metadata-get requires --type and --name')
    return print(await callTool(cfg, 'get_metadata_structure', {
      metaType: options.type,
      name: options.name,
      ...(options.sections ? { sections: options.sections.split(',').map((item) => item.trim()).filter(Boolean) } : {})
    }, options.raw))
  }

  if (options.command === 'query') {
    const query = validateReadOnlyQuery(await queryText(options))
    const params = queryParams(options)
    const args = { query, maxRows: positiveInt(options.maxRows, 100, '--max-rows', 2000), ...(params ? { params } : {}) }
    if (options.dryRun) return print({ ok: true, direct: true, endpoint: `${cfg.serviceUrl}/rpc`, method: 'tools/call', tool: 'execute_query', arguments: args })
    return print(await callTool(cfg, 'execute_query', args, options.raw))
  }

  usage()
  process.exitCode = 2
}

const print = (value) => console.log(JSON.stringify(value, null, 2))

const selfTest = async () => {
  const expectedAuth = `Basic ${Buffer.from('readonly:test-password').toString('base64')}`
  const calls = []
  const server = http.createServer(async (req, res) => {
    const reply = (status, payload) => { res.writeHead(status, { 'content-type': 'application/json' }); res.end(JSON.stringify(payload)) }
    if (req.headers.authorization !== expectedAuth) return reply(401, { error: 'bad auth' })
    if (req.method === 'GET' && req.url === '/Base/hs/mcp/health') return reply(200, { status: 'ok' })
    if (req.method === 'POST' && req.url === '/Base/hs/mcp/rpc') {
      let body = ''
      for await (const chunk of req) body += chunk
      const request = JSON.parse(body || '{}')
      calls.push(request)
      if (request.method === 'tools/list') return reply(200, { jsonrpc: '2.0', id: request.id, result: { tools: [{ name: 'list_metadata_objects' }, { name: 'get_metadata_structure' }, { name: 'execute_query' }] } })
      if (request.method === 'tools/call' && request.params?.name === 'list_metadata_objects') {
        return reply(200, { jsonrpc: '2.0', id: request.id, result: { content: [{ type: 'text', text: 'Document.ЗаказКлиента (Заказ клиента)' }], isError: false } })
      }
      if (request.method === 'tools/call' && request.params?.name === 'get_metadata_structure') {
        return reply(200, { jsonrpc: '2.0', id: request.id, result: { content: [{ type: 'text', text: 'fields: Номер, Дата, СуммаДокумента' }], isError: false } })
      }
      if (request.method === 'tools/call' && request.params?.name === 'execute_query') {
        return reply(200, { jsonrpc: '2.0', id: request.id, result: { content: [{ type: 'text', text: JSON.stringify({ columns: ['Value'], rows: [[1]], rowCount: 1 }) }], isError: false } })
      }
      return reply(200, { jsonrpc: '2.0', id: request.id, error: { code: -32601, message: 'not found' } })
    }
    return reply(404, { error: 'not found' })
  })
  await new Promise((resolve, reject) => {
    const onError = (error) => reject(new Error(`Cannot start localhost self-test server: ${error.message}`))
    server.once('error', onError)
    server.listen(0, '127.0.0.1', () => { server.off('error', onError); resolve() })
  })
  const { port } = server.address()
  const cfg = {
    serviceUrl: `http://127.0.0.1:${port}/Base/hs/mcp`,
    authorization: expectedAuth,
    timeoutMs: 5000,
    maxResponseBytes: 1024 * 1024,
    unlockCode: ''
  }
  try {
    const health = await requestJson(cfg, 'GET', 'health')
    const listed = await rpc(cfg, 'tools/list')
    const metadataList = await callTool(cfg, 'list_metadata_objects', { metaType: 'Documents', nameMask: 'Заказ', maxItems: 10 })
    const metadata = await callTool(cfg, 'get_metadata_structure', { metaType: 'Documents', name: 'ЗаказКлиента' })
    const query = validateReadOnlyQuery('ВЫБРАТЬ 1 КАК Value ГДЕ 1 = &Порог')
    const result = await callTool(cfg, 'execute_query', { query, maxRows: 1, params: { Порог: 1 } })
    let blocked = false
    try { validateReadOnlyQuery('УДАЛИТЬ ИЗ Справочник.Номенклатура') } catch { blocked = true }
    let manualLimitBlocked = false
    try { validateReadOnlyQuery('ВЫБРАТЬ ПЕРВЫЕ 1 1 КАК Value') } catch { manualLimitBlocked = true }
    const sentArguments = calls.find((call) => call.method === 'tools/call' && call.params?.name === 'execute_query')?.params?.arguments
    if (health?.status !== 'ok' || listed.result?.tools?.[2]?.name !== 'execute_query' || !String(metadataList.data).includes('ЗаказКлиента') || !String(metadata.data).includes('СуммаДокумента') || result.data?.rowCount !== 1 || !blocked || !manualLimitBlocked || sentArguments?.params?.Порог !== 1 || calls.length !== 4) {
      throw new Error('Self-test returned an unexpected result')
    }
    print({ ok: true, direct: true, checks: ['basic-auth', 'health', 'direct-rpc', 'tools-list', 'metadata-list', 'metadata-structure', 'query-call', 'query-params', 'response-parser', 'write-query-block', 'manual-limit-block'] })
  } finally {
    await new Promise((resolve) => server.close(resolve))
  }
}

main().catch((error) => { console.error(error?.message || String(error)); process.exit(1) })
