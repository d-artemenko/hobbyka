# 0z Operating System

A portable Codex project operating system. It packages the reusable parts of 0z:
local skills, safe hooks, README-first knowledge structure, source research,
goal specifications, feedback adaptation, and repeatable checks.

It does not copy live user memory. Files such as `ideas.md`, `tasks.md`,
`STATUS.md`, and `agent/feedback.md` are created from neutral starter templates.

## Quick Start

```bash
plugins/0z-operating-system/scripts/install-os.sh --target /path/to/project
/path/to/project/agent/bin/check-os
```

The installer writes:

- `AGENTS.md`
- `.codex/skills/`
- `.codex/hooks/` and `.codex/hooks.json`
- `agent/`, `docs/`, `research/`, and `handoff/` starter structure
- `agent/bin/check-os`

Use `--force` only when you intentionally want to replace existing generated
operating-system files.

## What Transfers

- General operating rules for autonomous Codex work.
- Six reusable skills: deep solutions, feedback adaptation, knowledge upkeep,
  source research, goal specifications, and specification workflow.
- A stop hook that runs the local structural check.
- Neutral starter documents for a new user.
- Install guidance that explains the plugin, configures automation when the
  app exposes automation tools, and recommends integrations after local
  discovery plus `https://www.skills.sh/` search.

## What Stays Local

- Personal notes, secrets, transcripts, and current task history.
- Absolute paths from the source machine.
- User-specific names, accounts, and project priorities.

## Verification

```bash
plugins/0z-operating-system/scripts/validate.sh
python3 "$PLUGIN_CREATOR/validate_plugin.py" plugins/0z-operating-system
node "$PLUGIN_EVAL/scripts/plugin-eval.js" analyze plugins/0z-operating-system --format markdown
```

## Layout

- `.codex-plugin/plugin.json` — plugin manifest.
- `skills/` — reusable Codex skills.
- `templates/` — files installed into a new workspace.
- `hooks/` — hook script copied into the target workspace.
- `scripts/` — installer and plugin checks.
- `examples/minimal-os/` — smallest expected installed shape.
