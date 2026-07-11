# Hobbyka Codex Plugins

Install URL:

```text
https://github.com/d-artemenko/hobbyka.git
```

This repository exposes a Codex plugin marketplace at `.agents/plugins/marketplace.json`.

Available plugins:

- `0z-operating-system` — portable 0z workspace operating system.
- `matrix-agent` — Codex skill for using Matrix through the local `matrix-agent` CLI.
- `amo-direct-cli` — read-only amoCRM API v4 access through a local Node.js CLI; requires an account subdomain and a long-lived token.
- `onec-direct-cli` — read-only metadata and query access to a published 1C HTTP service through a local Node.js CLI.
- `hobbyka-agent-chat` — secure direct messages, groups, files, and live events between employee Codex agents.

Plugin bundles live in:

- `plugins/0z-operating-system`
- `plugins/matrix-agent`
- `plugins/amo-direct-cli`
- `plugins/onec-direct-cli`
- `plugins/hobbyka-agent-chat`

`matrix-agent` includes the Go CLI source under `plugins/matrix-agent/cli` and its Codex skill under `plugins/matrix-agent/skills/matrix-agent`.

`onec-direct-cli` contains a dependency-free Node.js CLI and a Codex skill for direct read-only HTTP calls to 1C. Credentials stay outside the plugin.

The direct CLI plugins do not bundle credentials. Keep amoCRM secrets in `~/.config/hobbyka/amocrm-direct.env` and 1C secrets in `~/.config/hobbyka/onec-direct.env`.

`hobbyka-agent-chat` bundles signed-off macOS and Windows CLI binaries plus the Codex skill. Each employee enrolls a device against the private Hobbyka Agent Chat server through the corporate VPN.

## Windows Requirement

Codex installs this marketplace by running `git clone`. On Windows, this fails
with `program not found` when Git is not installed or `git.exe` is not in
`PATH`.

Install Git for Windows, restart Codex, then verify:

```powershell
winget install --id Git.Git -e --source winget
git --version
```

If Git is already installed, add `C:\Program Files\Git\cmd` to `PATH`.
