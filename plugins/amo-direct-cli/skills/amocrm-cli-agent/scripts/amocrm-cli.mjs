#!/usr/bin/env node
import fs from 'node:fs'
import http from 'node:http'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const skillDir = path.resolve(scriptDir, '..')
const ENTITIES = new Set(['leads', 'contacts', 'companies'])
const SENSITIVE_NAME = /(phone|email|e-mail|inn|ip address|телефон|почт|инн|ип адрес|номер телефона|виртуальный номер|подменный номер|принимающий номер)/iu

const usage = () => console.error([
  'Usage:',
  '  amocrm-cli.mjs config-check',
  '  amocrm-cli.mjs auth-check [--raw]',
  '  amocrm-cli.mjs fields --entity ENTITY [--limit N] [--page N] [--all] [--max-pages N] [--raw]',
  '  amocrm-cli.mjs list --entity ENTITY [--query TEXT] [--filter-json JSON] [--params-json JSON]',
  '                      [--order FIELD:asc|desc] [--with CSV] [--limit N] [--page N]',
  '                      [--all] [--max-pages N] [--include-sensitive] [--raw]',
  '  amocrm-cli.mjs get --entity ENTITY --id ID [--with CSV] [--include-sensitive] [--raw]',
  '  amocrm-cli.mjs pipelines [--id ID] [--include-sensitive] [--raw]',
  '  amocrm-cli.mjs users [--limit N] [--page N] [--all] [--max-pages N] [--include-sensitive] [--raw]',
  '  amocrm-cli.mjs self-test',
  '',
  'Required: AMOCRM_SUBDOMAIN or AMOCRM_BASE_URL, plus AMOCRM_LONG_LIVED_TOKEN or AMOCRM_ACCESS_TOKEN',
  'Optional: AMOCRM_ENV_FILE, AMOCRM_TIMEOUT_MS, AMOCRM_MAX_RESPONSE_BYTES'
].join('\n'))

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
  const explicit = process.env.AMOCRM_ENV_FILE
  const processEndpointConfigured = Boolean(process.env.AMOCRM_BASE_URL || process.env.AMOCRM_SUBDOMAIN)
  const candidates = explicit
    ? [path.resolve(explicit)]
    : [path.join(skillDir, '.env'), path.join(os.homedir(), '.config', 'hobbyka', 'amocrm-direct.env')]
  for (const envPath of [...new Set(candidates)]) {
    if (!fs.existsSync(envPath)) continue
    for (const [key, value] of Object.entries(parseDotenv(fs.readFileSync(envPath, 'utf8')))) {
      if (processEndpointConfigured && ['AMOCRM_BASE_URL', 'AMOCRM_SUBDOMAIN'].includes(key)) continue
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
  const options = { command: argv[2] || 'help', all: false, raw: false, includeSensitive: false }
  if (['-h', '--help'].includes(options.command)) options.command = 'help'
  const args = argv.slice(3)
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]
    if (arg === '--entity') options.entity = takeValue(args, index++, arg)
    else if (arg === '--id') options.id = takeValue(args, index++, arg)
    else if (arg === '--limit') options.limit = takeValue(args, index++, arg)
    else if (arg === '--page') options.page = takeValue(args, index++, arg)
    else if (arg === '--max-pages') options.maxPages = takeValue(args, index++, arg)
    else if (arg === '--query') options.query = takeValue(args, index++, arg)
    else if (arg === '--filter-json') options.filterJson = takeValue(args, index++, arg)
    else if (arg === '--params-json') options.paramsJson = takeValue(args, index++, arg)
    else if (arg === '--order') options.order = takeValue(args, index++, arg)
    else if (arg === '--with') options.with = takeValue(args, index++, arg)
    else if (arg === '--all') options.all = true
    else if (arg === '--raw') options.raw = true
    else if (arg === '--include-sensitive') options.includeSensitive = true
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

const positiveInt = (value, fallback, option, maximum) => {
  const number = value == null ? fallback : Number(value)
  if (!Number.isInteger(number) || number < 1 || number > maximum) throw new Error(`${option} must be an integer from 1 to ${maximum}`)
  return number
}

const config = () => {
  const subdomain = env('AMOCRM_SUBDOMAIN')
  const explicitBase = env('AMOCRM_BASE_URL')
  if (!explicitBase && !subdomain) throw new Error('AMOCRM_SUBDOMAIN or AMOCRM_BASE_URL is required')
  if (!explicitBase && !/^[a-z0-9-]+$/i.test(subdomain)) throw new Error('AMOCRM_SUBDOMAIN contains unsupported characters')
  const root = (explicitBase || `https://${subdomain}.amocrm.ru`).replace(/\/+$/, '').replace(/\/api\/v4$/i, '')
  const parsed = new URL(root)
  if (parsed.username || parsed.password) throw new Error('Do not embed amoCRM credentials in the URL')
  if (parsed.protocol !== 'https:' && !(parsed.protocol === 'http:' && isPrivateHost(parsed.hostname))) throw new Error('amoCRM API requires HTTPS')
  const officialHost = /(?:^|\.)amocrm\.(?:ru|com)$/i.test(parsed.hostname) || /(?:^|\.)kommo\.com$/i.test(parsed.hostname)
  if (parsed.protocol === 'https:' && !officialHost && !isPrivateHost(parsed.hostname) && env('AMOCRM_ALLOW_CUSTOM_HOST') !== '1') {
    throw new Error('Custom amoCRM API host is blocked; set AMOCRM_ALLOW_CUSTOM_HOST=1 only for a trusted compatible gateway')
  }
  const accessToken = env('AMOCRM_ACCESS_TOKEN') || env('AMOCRM_LONG_LIVED_TOKEN')
  if (!accessToken) throw new Error('AMOCRM_LONG_LIVED_TOKEN or AMOCRM_ACCESS_TOKEN is required')
  const timeoutMs = positiveInt(env('AMOCRM_TIMEOUT_MS', '60000'), 60000, 'AMOCRM_TIMEOUT_MS', 600000)
  const maxResponseBytes = positiveInt(env('AMOCRM_MAX_RESPONSE_BYTES', '10485760'), 10485760, 'AMOCRM_MAX_RESPONSE_BYTES', 104857600)
  return { root, apiBase: `${root}/api/v4`, accessToken, timeoutMs, maxResponseBytes }
}

const safeDetail = (value) => String(value || '')
  .replace(/Bearer\s+[A-Za-z0-9._~+\/-]+/gi, 'Bearer [redacted]')
  .replace(/\s+/g, ' ')
  .slice(0, 500)

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
      throw new Error(`amoCRM response exceeds ${limit} bytes`)
    }
    chunks.push(value)
  }
  const merged = new Uint8Array(bytes)
  let offset = 0
  for (const chunk of chunks) { merged.set(chunk, offset); offset += chunk.byteLength }
  return new TextDecoder().decode(merged).replace(/^\uFEFF/, '')
}

const requestJson = async (cfg, resource, params = {}) => {
  const url = new URL(`${cfg.apiBase}/${String(resource).replace(/^\/+/, '')}`)
  for (const [key, value] of Object.entries(params)) appendParam(url.searchParams, key, value)
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), cfg.timeoutMs)
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json', Authorization: `Bearer ${cfg.accessToken}`, 'User-Agent': 'Hobbyka-amoCRM-readonly-cli/0.1' },
      signal: controller.signal,
      redirect: 'error'
    })
    const text = await readLimited(response, cfg.maxResponseBytes)
    if (!response.ok) throw new Error(`amoCRM HTTP ${response.status}${text ? `: ${safeDetail(text)}` : ''}`)
    try { return text ? JSON.parse(text) : null } catch { throw new Error(`amoCRM returned invalid JSON: ${safeDetail(text)}`) }
  } catch (error) {
    if (error?.name === 'AbortError') throw new Error(`amoCRM request timed out after ${cfg.timeoutMs} ms`)
    if (error?.cause?.code) throw new Error(`amoCRM connection failed: ${error.cause.code}`)
    throw error
  } finally {
    clearTimeout(timer)
  }
}

const appendParam = (params, key, value) => {
  if (value == null) return
  if (Array.isArray(value)) {
    for (const item of value) appendParam(params, key, item)
    return
  }
  if (!['string', 'number', 'boolean'].includes(typeof value)) throw new Error(`Query parameter ${key} must be scalar or an array of scalars`)
  params.append(key, String(value))
}

const jsonObject = (source, option) => {
  if (!source) return {}
  let value
  try { value = JSON.parse(source) } catch { throw new Error(`${option} must be valid JSON`) }
  if (!value || Array.isArray(value) || typeof value !== 'object') throw new Error(`${option} must be a JSON object`)
  return value
}

const entity = (value) => {
  const normalized = String(value || '').trim().toLowerCase()
  if (!ENTITIES.has(normalized)) throw new Error(`--entity must be one of: ${[...ENTITIES].join(', ')}`)
  return normalized
}

const orderParams = (source) => {
  if (!source) return {}
  const match = String(source).match(/^([A-Za-z0-9_]+):(asc|desc)$/i)
  if (!match) throw new Error('--order must have FIELD:asc or FIELD:desc format')
  return { [`order[${match[1]}]`]: match[2].toLowerCase() }
}

const collectionParams = (options, defaultLimit, maxLimit) => {
  const params = {
    ...jsonObject(options.paramsJson, '--params-json'),
    ...Object.fromEntries(Object.entries(jsonObject(options.filterJson, '--filter-json')).map(([key, value]) => [key.startsWith('filter[') ? key : `filter[${key}]`, value])),
    ...orderParams(options.order),
    limit: positiveInt(options.limit, defaultLimit, '--limit', maxLimit),
    page: positiveInt(options.page, 1, '--page', 100000)
  }
  if (options.query) params.query = options.query
  if (options.with) params.with = options.with
  return params
}

const redactSensitive = (value) => {
  if (Array.isArray(value)) return value.map(redactSensitive)
  if (!value || typeof value !== 'object') return value
  const result = {}
  const fieldName = String(value.field_name || value.name || '')
  const sensitiveField = SENSITIVE_NAME.test(fieldName)
  for (const [key, item] of Object.entries(value)) {
    if (sensitiveField && ['values', 'value'].includes(key)) result[key] = '[redacted]'
    else if (SENSITIVE_NAME.test(key)) result[key] = '[redacted]'
    else result[key] = redactSensitive(item)
  }
  return result
}

const output = (value, options) => {
  const safe = options.includeSensitive ? value : redactSensitive(value)
  console.log(JSON.stringify(safe, null, 2))
}

const fetchCollection = async (cfg, resource, embeddedKey, params, options) => {
  if (!options.all) return requestJson(cfg, resource, params)
  const maxPages = positiveInt(options.maxPages, 20, '--max-pages', 100)
  const items = []
  let pages = 0
  let page = Number(params.page)
  while (pages < maxPages) {
    const payload = await requestJson(cfg, resource, { ...params, page })
    const batch = payload?._embedded?.[embeddedKey]
    if (Array.isArray(batch)) items.push(...batch)
    pages += 1
    if (!payload?._links?.next || !Array.isArray(batch) || batch.length === 0) break
    page += 1
  }
  return { _meta: { pages, item_count: items.length, truncated: pages === maxPages }, _embedded: { [embeddedKey]: items } }
}

const selfTest = async () => {
  const expected = 'Bearer local-test-token'
  const calls = []
  const server = http.createServer(async (req, res) => {
    const reply = (status, payload) => { res.writeHead(status, { 'content-type': 'application/json' }); res.end(JSON.stringify(payload)) }
    if (req.headers.authorization !== expected) return reply(401, { error: 'bad auth' })
    calls.push(req.url)
    if (req.url === '/api/v4/account') return reply(200, { id: 1, name: 'Test', subdomain: 'test' })
    if (req.url?.startsWith('/api/v4/leads?')) return reply(200, { _embedded: { leads: [{ id: 7, name: 'Deal', custom_fields_values: [{ field_name: 'Телефон', values: [{ value: '+7999' }] }] }] }, _links: { self: {} } })
    return reply(404, { error: 'not found' })
  })
  await new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', resolve)
  })
  const { port } = server.address()
  const cfg = { root: `http://127.0.0.1:${port}`, apiBase: `http://127.0.0.1:${port}/api/v4`, accessToken: 'local-test-token', timeoutMs: 5000, maxResponseBytes: 1024 * 1024 }
  try {
    const account = await requestJson(cfg, 'account')
    const leads = await requestJson(cfg, 'leads', { limit: 10, page: 1, query: 'Deal' })
    const redacted = redactSensitive(leads)
    if (account.id !== 1) throw new Error('account test failed')
    if (redacted._embedded.leads[0].custom_fields_values[0].values !== '[redacted]') throw new Error('redaction test failed')
    if (!calls.some((item) => item.includes('query=Deal'))) throw new Error('query parameter test failed')
    console.log(JSON.stringify({ ok: true, tests: ['authorization', 'account', 'query-parameters', 'sensitive-field-redaction'] }, null, 2))
  } finally {
    await new Promise((resolve) => server.close(resolve))
  }
}

const main = async () => {
  loadEnv()
  const options = parseArgs(process.argv)
  if (options.command === 'help') { usage(); return }
  if (options.command === 'self-test') return selfTest()
  const cfg = config()

  if (options.command === 'config-check') {
    return output({ ok: true, api_base: cfg.apiBase, token_configured: true, token_source: env('AMOCRM_ACCESS_TOKEN') ? 'AMOCRM_ACCESS_TOKEN' : 'AMOCRM_LONG_LIVED_TOKEN', timeout_ms: cfg.timeoutMs, max_response_bytes: cfg.maxResponseBytes }, options)
  }
  if (options.command === 'auth-check') {
    const account = await requestJson(cfg, 'account')
    return output(options.raw ? account : { ok: true, account: { id: account?.id, name: account?.name, subdomain: account?.subdomain, country: account?.country, current_user_id: account?.current_user_id } }, options)
  }
  if (options.command === 'fields') {
    const name = entity(options.entity)
    const params = collectionParams(options, 50, 50)
    const payload = await fetchCollection(cfg, `${name}/custom_fields`, 'custom_fields', params, options)
    return output(options.raw ? payload : { ok: true, entity: name, data: payload }, options)
  }
  if (options.command === 'list') {
    const name = entity(options.entity)
    const params = collectionParams(options, 50, 250)
    const payload = await fetchCollection(cfg, name, name, params, options)
    return output(options.raw ? payload : { ok: true, entity: name, data: payload }, options)
  }
  if (options.command === 'get') {
    const name = entity(options.entity)
    const id = positiveInt(options.id, null, '--id', Number.MAX_SAFE_INTEGER)
    const payload = await requestJson(cfg, `${name}/${id}`, options.with ? { with: options.with } : {})
    return output(options.raw ? payload : { ok: true, entity: name, data: payload }, options)
  }
  if (options.command === 'pipelines') {
    const resource = options.id ? `leads/pipelines/${positiveInt(options.id, null, '--id', Number.MAX_SAFE_INTEGER)}` : 'leads/pipelines'
    const payload = await requestJson(cfg, resource)
    return output(options.raw ? payload : { ok: true, data: payload }, options)
  }
  if (options.command === 'users') {
    const params = collectionParams(options, 50, 250)
    const payload = await fetchCollection(cfg, 'users', 'users', params, options)
    return output(options.raw ? payload : { ok: true, data: payload }, options)
  }
  usage()
  process.exitCode = 2
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, error: safeDetail(error?.message || error) }, null, 2))
  process.exitCode = 1
})
