# Hooks

Hooks are small deterministic checks for a 0z-style workspace.

- `check-os.sh` runs `agent/bin/check-os` before a Codex session stops.

New hooks should be short, local, repeatable, and safe. They should not print
secrets, call models, or rewrite project state.

