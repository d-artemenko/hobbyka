# Hobbyka Codex Plugins

Install URL:

```text
https://github.com/d-artemenko/hobbyka.git
```

This repository exposes a Codex plugin marketplace at `.agents/plugins/marketplace.json`.

Available plugins:

- `0z-operating-system` — portable 0z workspace operating system.
- `matrix-agent` — Codex skill for using Matrix through the local `matrix-agent` CLI.\n- `onec-direct-cli` — direct read-only 1C access through a local Node.js CLI.

Plugin bundles live in:

- `plugins/0z-operating-system`
- `plugins/matrix-agent`\n- `plugins/onec-direct-cli`

`matrix-agent` includes the Go CLI source under `plugins/matrix-agent/cli` and its Codex skill under `plugins/matrix-agent/skills/matrix-agent`.\n\n`onec-direct-cli` contains a dependency-free Node.js CLI and a Codex skill for direct read-only HTTP calls to 1C. Credentials stay outside the plugin.

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
