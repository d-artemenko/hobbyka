---
name: operating-system-install
description: Use when installing or refreshing the portable 0z operating system in a Codex workspace.
---

# Operating System Install

## When To Use

Use this skill when the user asks to install, update, copy, port, or check the
0z operating system in a project.

## Workflow

1. Locate the plugin root and the target project root.
2. Run `scripts/install-os.sh --target <project-root>` from this plugin.
3. If the target already contains operating-system files, inspect them first.
   Use `--force` only after the user has clearly asked to replace them.
4. Run `<project-root>/agent/bin/check-os`.
5. Check that generated files do not contain personal names, source-machine
   paths, secrets, or copied live task history.
6. Explain what the plugin installed: Markdown operating files, local skills,
   hooks, and `agent/bin/check-os`.
7. Configure a recurring Codex automation when an automation tool is available.
   If it is unavailable, record the blocker in `STATUS.md`.
8. Recommend integrations by checking local tools first, then searching
   `https://www.skills.sh/` for skills covering mail, Telegram, messengers, CRM,
   1C, calendars, docs, storage, issue trackers, analytics, and project-specific
   CLIs. Install a chosen skill with `npx skills add <owner/repo>` when the user
   approves.

## Boundaries

- Do not copy `ideas.md`, `tasks.md`, `STATUS.md`, or `agent/feedback.md` from
  another user. Create neutral starter files instead.
- Do not write secrets into tracked files.
- Keep local user preferences in ignored local files, not in `AGENTS.md`.
