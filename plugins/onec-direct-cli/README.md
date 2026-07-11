# Direct 1C CLI

Codex plugin for direct read-only access to a published 1C HTTP service through a local dependency-free Node.js CLI.

```text
Codex -> onec-cli-agent skill -> local Node.js CLI -> published HTTP service inside 1C
```

The plugin does not include an MCP server, OpenCode, RAG, SSE, Docker, a proxy, or another model. Codex inspects only the metadata it needs, writes the 1C query itself, and sends a deterministic read-only request directly to 1C.

## Configuration

Store connection settings outside the plugin in `~/.config/hobbyka/onec-direct.env` and restrict the file to the current user:

```env
ONEC_HTTP_BASE_URL=https://server/BaseName
ONEC_HTTP_SERVICE_ROOT=mcp
ONEC_HTTP_USERNAME=ReadOnlyUser
ONEC_HTTP_PASSWORD=
ONEC_HTTP_TIMEOUT_MS=60000
```

You can provide a complete service address through `ONEC_HTTP_SERVICE_URL=https://server/BaseName/hs/mcp` instead of `BASE_URL` plus `SERVICE_ROOT`. The CLI also supports `.env` in the current working directory or skill directory, and an explicit file through `ONEC_HTTP_ENV_FILE`.

Never commit credentials. The 1C user must have server-side read-only rights.

## Commands

```bash
node skills/onec-cli-agent/scripts/onec-cli.mjs config-check
node skills/onec-cli-agent/scripts/onec-cli.mjs health
node skills/onec-cli-agent/scripts/onec-cli.mjs tools
node skills/onec-cli-agent/scripts/onec-cli.mjs metadata-list --type Documents --name-mask Заказ --max-items 20
node skills/onec-cli-agent/scripts/onec-cli.mjs metadata-get --type Documents --name ЗаказКлиента
node skills/onec-cli-agent/scripts/onec-cli.mjs query --text "ВЫБРАТЬ ..." --max-rows 50
node skills/onec-cli-agent/scripts/onec-cli.mjs self-test
```

Use `--file` or `--stdin` for long queries. Do not write `ПЕРВЫЕ N` manually; use `--max-rows`.

## Allowed operations

- `GET /health`
- JSON-RPC `tools/list`
- `list_metadata_objects`
- `get_metadata_structure`
- `execute_query`

The CLI rejects non-`ВЫБРАТЬ` queries, blocks write keywords, limits result rows, enforces HTTPS for remote hosts, and never prints credentials or authorization headers.

See [PRIVACY.md](PRIVACY.md) and [TERMS.md](TERMS.md) for the plugin policies.
