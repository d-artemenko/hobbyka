# Knowledge Model

## Entities

- Owner — the person whose priorities guide the workspace.
- Project operating system — the rules, status, skills, hooks, and documents.
- Task — prioritized work from `tasks.md`.
- Idea — free thought from `ideas.md`.
- Skill — local instruction under `.codex/skills/`.
- Hook — local deterministic check under `.codex/hooks/`.
- Solution — `solution.md` inside `agent/tasks/<number>-<name>/`.
- Source — research material tracked under `research/`.

## Events

- Run — one cycle of choosing and working on one task.
- Feedback — a correction that may change behavior.
- Check — `agent/bin/check-os`.
- Save — git commit and optional push.

## Documents

- `AGENTS.md` — main operating rules.
- `STATUS.md` — current state.
- `agent/INDEX.md` — main index.
- `.codex/skills/*/SKILL.md` — local skills.
- `.codex/hooks.json` — hook wiring.

