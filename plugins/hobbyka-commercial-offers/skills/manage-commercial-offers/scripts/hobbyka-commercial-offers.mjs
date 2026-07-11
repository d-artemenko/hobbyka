#!/usr/bin/env node

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";

const DEFAULT_API_URL = "https://hobbyka.ru/api/commercial-offers/?action=createCommercialOffer";
const DEFAULT_WEB_BASE = "https://hobbyka.ru";
const DEFAULT_TIMEOUT_MS = 60_000;

function expandHome(value) {
  if (value === "~") return os.homedir();
  if (value.startsWith("~/")) return path.join(os.homedir(), value.slice(2));
  return value;
}

function config(env = process.env) {
  const apiUrl = env.HOBBYKA_CO_API_URL || DEFAULT_API_URL;
  const webBaseUrl = (env.HOBBYKA_CO_WEB_BASE_URL || DEFAULT_WEB_BASE).replace(/\/$/, "");
  const timeoutMs = Number(env.HOBBYKA_CO_TIMEOUT_MS || DEFAULT_TIMEOUT_MS);
  const historyFile = expandHome(env.HOBBYKA_CO_HISTORY_FILE || "~/.config/hobbyka/commercial-offers-history.json");
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1_000 || timeoutMs > 300_000) {
    throw new Error("HOBBYKA_CO_TIMEOUT_MS must be an integer from 1000 to 300000");
  }
  assertTrustedUrl(apiUrl, env);
  assertTrustedUrl(webBaseUrl, env);
  return { apiUrl, webBaseUrl, timeoutMs, historyFile };
}

function assertTrustedUrl(raw, env = process.env) {
  let url;
  try {
    url = new URL(raw);
  } catch {
    throw new Error(`Invalid URL: ${raw}`);
  }
  const local = ["localhost", "127.0.0.1", "::1"].includes(url.hostname);
  const official = url.protocol === "https:" && url.hostname === "hobbyka.ru";
  if (!official && !local && env.HOBBYKA_CO_ALLOW_CUSTOM_HOST !== "1") {
    throw new Error("Custom hosts require HOBBYKA_CO_ALLOW_CUSTOM_HOST=1");
  }
  if (!official && !local && url.protocol !== "https:") {
    throw new Error("Custom remote hosts must use HTTPS");
  }
}

function parseArgs(argv) {
  const [command = "help", ...rest] = argv;
  const options = { item: [] };
  const positional = [];
  const valueKeys = new Set([
    "item", "company", "person", "phone", "email", "object", "copy-number",
    "input", "limit"
  ]);
  for (let index = 0; index < rest.length; index += 1) {
    const token = rest[index];
    if (!token.startsWith("--")) {
      positional.push(token);
      continue;
    }
    const key = token.slice(2);
    if (valueKeys.has(key)) {
      const value = rest[index + 1];
      if (value === undefined || value.startsWith("--")) throw new Error(`--${key} requires a value`);
      index += 1;
      if (key === "item") options.item.push(value);
      else options[key] = value;
    } else if (["stdin", "yes", "dry-run", "json", "check", "open", "help"].includes(key)) {
      options[key] = true;
    } else {
      throw new Error(`Unknown option: --${key}`);
    }
  }
  return { command, options, positional };
}

function parseItem(value) {
  const match = /^(\d+):(\d+)$/.exec(value);
  if (!match) throw new Error(`Invalid item '${value}'. Expected ID:QUANTITY`);
  const quantity = Number(match[2]);
  if (quantity < 1 || quantity > 100_000) throw new Error(`Invalid quantity in '${value}'`);
  return { ID: match[1], QUANTITY: quantity };
}

function validatePayload(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) throw new Error("Payload must be a JSON object");
  if (!Array.isArray(payload.basket_items) || payload.basket_items.length === 0) throw new Error("basket_items must contain at least one item");
  const basketItems = payload.basket_items.map((item, index) => {
    const id = String(item?.ID ?? "").trim();
    const quantity = Number(item?.QUANTITY);
    if (!/^\d+$/.test(id)) throw new Error(`basket_items[${index}].ID must contain digits only`);
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 100_000) {
      throw new Error(`basket_items[${index}].QUANTITY must be an integer from 1 to 100000`);
    }
    return { ID: id, QUANTITY: quantity };
  });
  if (!payload.props || typeof payload.props !== "object" || Array.isArray(payload.props)) throw new Error("props must be an object");
  const requiredProps = ["COMPANY", "PERSON", "PHONE", "EMAIL", "OBJECT"];
  const props = {};
  for (const key of requiredProps) {
    const value = String(payload.props[key] ?? "").trim();
    if (!value) throw new Error(`props.${key} is required`);
    if (value.length > 500) throw new Error(`props.${key} is too long`);
    props[key] = value;
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(props.EMAIL)) throw new Error("props.EMAIL is invalid");
  const copyNumber = payload.copy_number === undefined || payload.copy_number === null || payload.copy_number === ""
    ? null
    : Number(payload.copy_number);
  if (copyNumber !== null && (!Number.isInteger(copyNumber) || copyNumber < 1)) {
    throw new Error("copy_number must be null or a positive integer");
  }
  return { basket_items: basketItems, props, copy_number: copyNumber };
}

function payloadFromOptions(options) {
  return validatePayload({
    basket_items: options.item.map(parseItem),
    props: {
      COMPANY: options.company,
      PERSON: options.person,
      PHONE: options.phone,
      EMAIL: options.email,
      OBJECT: options.object
    },
    copy_number: options["copy-number"] ?? null
  });
}

function readStdin() {
  return fs.readFileSync(0, "utf8");
}

function readPayload(options) {
  const sources = Number(Boolean(options.input)) + Number(Boolean(options.stdin)) + Number(options.item.length > 0);
  if (sources !== 1) throw new Error("Use exactly one payload source: --input, --stdin, or --item flags");
  if (options.input) return validatePayload(JSON.parse(fs.readFileSync(options.input, "utf8")));
  if (options.stdin) return validatePayload(JSON.parse(readStdin()));
  return payloadFromOptions(options);
}

async function fetchWithTimeout(url, options, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (error) {
    if (error?.name === "AbortError") throw new Error(`Request timed out after ${timeoutMs} ms`);
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

function unwrapCreateResponse(body) {
  const result = body?.data?.data;
  if (body?.status !== "success" || body?.data?.success !== true || !result?.number) {
    const errors = body?.errors || body?.data?.errors || [];
    throw new Error(`API did not create an offer${errors.length ? `: ${JSON.stringify(errors)}` : ""}`);
  }
  return result;
}

function historyRecord(result, payload) {
  return {
    number: String(result.number),
    id: result.id ?? null,
    version: result.version ?? null,
    created_at: new Date().toISOString(),
    basket_items: payload.basket_items,
    offer_link: result.offer_link || null,
    pdf: result.pdf ? { id: result.pdf.id ?? null, url: result.pdf.url ?? null, name: result.pdf.name ?? null } : null,
    qr_code_url: result.qr_code_url || null
  };
}

function loadHistory(file) {
  if (!fs.existsSync(file)) return [];
  const parsed = JSON.parse(fs.readFileSync(file, "utf8"));
  if (!Array.isArray(parsed)) throw new Error(`History file is not an array: ${file}`);
  return parsed;
}

function saveHistory(file, record) {
  const dir = path.dirname(file);
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  const records = loadHistory(file).filter((item) => item.number !== record.number);
  records.unshift(record);
  const temp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(temp, `${JSON.stringify(records.slice(0, 500), null, 2)}\n`, { mode: 0o600 });
  fs.chmodSync(temp, 0o600);
  fs.renameSync(temp, file);
}

function offerUrl(number, cfg) {
  return `${cfg.webBaseUrl}/personal/commercial_offers/?NUMBER=${encodeURIComponent(number)}`;
}

function validateNumber(number) {
  if (!/^\d+(?:-\d+)+$/.test(number || "")) throw new Error("Offer number must look like 14891864-1-1");
  return number;
}

function print(value, json = false) {
  if (json) {
    process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
    return;
  }
  for (const [key, item] of Object.entries(value)) {
    if (item !== null && item !== undefined && item !== "") process.stdout.write(`${key}: ${item}\n`);
  }
}

async function commandCreate(options, cfg) {
  const payload = readPayload(options);
  if (options["dry-run"]) {
    print({ dry_run: true, payload }, true);
    return;
  }
  if (!options.yes) throw new Error("Live creation requires --yes. Run with --dry-run first");
  const response = await fetchWithTimeout(cfg.apiUrl, {
    method: "POST",
    headers: { "content-type": "application/json", "accept": "application/json" },
    body: JSON.stringify(payload)
  }, cfg.timeoutMs);
  const text = await response.text();
  let body;
  try { body = JSON.parse(text); } catch { throw new Error(`API returned non-JSON response (HTTP ${response.status})`); }
  if (!response.ok) throw new Error(`API returned HTTP ${response.status}: ${JSON.stringify(body)}`);
  const result = unwrapCreateResponse(body);
  const record = historyRecord(result, payload);
  saveHistory(cfg.historyFile, record);
  print(options.json ? result : {
    status: "success",
    number: record.number,
    offer_link: record.offer_link,
    pdf_url: record.pdf?.url,
    qr_code_url: record.qr_code_url
  }, options.json);
}

async function commandView(number, options, cfg) {
  validateNumber(number);
  const stored = loadHistory(cfg.historyFile).find((item) => item.number === number) || null;
  const url = stored?.offer_link || offerUrl(number, cfg);
  let httpStatus = null;
  let reachable = null;
  if (options.check) {
    const response = await fetchWithTimeout(url, { method: "GET", redirect: "follow" }, cfg.timeoutMs);
    httpStatus = response.status;
    reachable = response.ok;
  }
  if (options.open) await openUrl(url);
  const result = {
    number,
    found_in_local_history: Boolean(stored),
    offer_link: url,
    pdf_url: stored?.pdf?.url || null,
    qr_code_url: stored?.qr_code_url || null,
    checked: Boolean(options.check),
    reachable,
    http_status: httpStatus,
    opened: Boolean(options.open)
  };
  print(result, options.json);
}

function commandList(options, cfg) {
  const limit = Number(options.limit || 20);
  if (!Number.isInteger(limit) || limit < 1 || limit > 500) throw new Error("--limit must be an integer from 1 to 500");
  const rows = loadHistory(cfg.historyFile).slice(0, limit);
  if (options.json) return print(rows, true);
  if (rows.length === 0) return print({ status: "Local history is empty" });
  for (const row of rows) print({ number: row.number, created_at: row.created_at, offer_link: row.offer_link });
}

function openUrl(url) {
  const command = process.platform === "darwin" ? "open" : process.platform === "win32" ? "cmd" : "xdg-open";
  const args = process.platform === "win32" ? ["/c", "start", "", url] : [url];
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { detached: true, stdio: "ignore" });
    child.once("error", reject);
    child.once("spawn", () => { child.unref(); resolve(); });
  });
}

function commandConfigCheck(cfg, json) {
  print({
    status: "ok",
    api_url: cfg.apiUrl,
    web_base_url: cfg.webBaseUrl,
    timeout_ms: cfg.timeoutMs,
    history_file: cfg.historyFile,
    authentication: "not required"
  }, json);
}

function commandSelfTest(json) {
  const sample = validatePayload({
    basket_items: [{ ID: "7112", QUANTITY: 2 }],
    props: { COMPANY: "Test", PERSON: "Test", PHONE: "+70000000000", EMAIL: "test@example.com", OBJECT: "Test" },
    copy_number: null
  });
  const parsed = parseItem("12741:3");
  const result = unwrapCreateResponse({ status: "success", data: { success: true, data: { number: "1-1-1" } } });
  const checks = {
    payload_validation: sample.basket_items[0].QUANTITY === 2,
    item_parsing: parsed.ID === "12741" && parsed.QUANTITY === 3,
    response_unwrap: result.number === "1-1-1",
    number_validation: validateNumber("14891864-1-1") === "14891864-1-1"
  };
  const ok = Object.values(checks).every(Boolean);
  print({ status: ok ? "ok" : "failed", checks }, json);
  if (!ok) process.exitCode = 1;
}

function help() {
  process.stdout.write(`Hobbyka commercial offers CLI\n\nCommands:\n  config-check [--json]\n  self-test [--json]\n  create (--item ID:QTY ... | --input FILE | --stdin) [fields] (--dry-run | --yes) [--json]\n  view NUMBER [--check] [--open] [--json]\n  list [--limit N] [--json]\n`);
}

async function main() {
  const { command, options, positional } = parseArgs(process.argv.slice(2));
  if (command === "help" || options.help) return help();
  const cfg = config();
  if (command === "config-check") return commandConfigCheck(cfg, options.json);
  if (command === "self-test") return commandSelfTest(options.json);
  if (command === "create") return commandCreate(options, cfg);
  if (command === "view") return commandView(positional[0], options, cfg);
  if (command === "list") return commandList(options, cfg);
  throw new Error(`Unknown command: ${command}`);
}

main().catch((error) => {
  process.stderr.write(`error: ${error.message}\n`);
  process.exitCode = 1;
});
