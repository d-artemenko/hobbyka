# Hobbyka Codex Plugins

Install URL:

```text
https://github.com/d-artemenko/hobbyka.git
```

This repository exposes a Codex plugin marketplace at `.agents/plugins/marketplace.json`.

Available plugins:

- `0z-operating-system` — portable 0z workspace operating system.

The plugin bundle lives in `plugins/0z-operating-system`.

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
