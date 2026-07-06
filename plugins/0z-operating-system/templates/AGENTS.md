# Project Operating System

This repository is a personal work operating system for deep agent-assisted
thinking, research, implementation, and follow-through.

The agent's priority is autonomy and complete fulfillment of the user's request.
If an obstacle appears, the agent should research alternatives, try reasonable
routes, and either complete the intended outcome or document the exhausted
options honestly.

## Required Reading

- `ideas.md` — free ideas. Edit only after explicit permission.
- `tasks.md` — prioritized large tasks. Edit only after explicit permission.
- `STATUS.md` — current state, recent work, open questions, and next step.
- `docs/integrations.md` — integration discovery and recommendation guide.
- `agent/status-map.md` — short map of current focus.
- `agent/attention-map.md` — first-pass guide for long documents.
- `agent/INDEX.md` — index of important results.
- `agent/recent-solutions-map.md` — recent solution map.
- `agent/feedback.md` — feedback that should change agent behavior.
- `agent/feedback-map.md` — thematic map of feedback.
- `.codex/skills/INDEX.md` — local skills.
- `.codex/hooks/README.md` and `.codex/hooks/policy.md` — hook rules.
- `agent/AUTOMATION.md` — one full background run.
- `agent/knowledge-model.md` — lightweight knowledge model.

## How To Work

1. Choose exactly one task per run.
2. Prefer the current priority in `tasks.md`.
3. Before starting a new open-ended task, ask when to stop. If a stopping
   condition already exists, use it.
4. If no stopping condition exists, treat the task as open. Do not close it
   because it feels good enough.
5. If no obvious improvement is visible, widen the investigation.
6. For broad work, use narrow subagents when the environment allows it.
7. Verify important subagent findings yourself.
8. Create or update `agent/tasks/<number>-<short-name>/solution.md`.
9. At the end, ask what agent behavior should change.
10. If the change is durable, update `agent/feedback.md`, local skills, hooks,
    or this file.
11. Update `STATUS.md` and `agent/INDEX.md`.
12. Run `agent/bin/check-os`.
13. Save changes in git.
14. Report briefly: chosen task, findings, changed files, checks, and next
    decision.

## Plugin Explanation

When installing or refreshing this operating system, explain to the user what
the plugin added and how to use it:

- Markdown files hold ideas, tasks, status, research, decisions, and handoff.
- Local skills teach repeatable workflows.
- Hooks and `agent/bin/check-os` keep the workspace structure valid.
- `https://www.skills.sh/` helps find external skills when local skills are not
  enough.

## Automation

After installation, configure a recurring Codex automation when the app exposes
an automation tool. Use it to run one narrow operating-system cycle on a clear
interval. If no automation tool is available, record the blocker in `STATUS.md`
and give the exact manual command instead of pretending it was configured.

## Integration Recommendations

When asked to improve the workspace, recommend useful integrations after local
discovery. Start with:

- mail;
- Telegram and other messengers;
- CRM systems present on the computer;
- 1C and accounting tools;
- calendars, docs, storage, issue trackers, analytics, and project-specific
  CLIs.

Before recommending an integration, inspect installed tools first, then search
`https://www.skills.sh/` for matching skills. Prefer installed tools over new
dependencies.

## Local Skills

- `.codex/skills/deep-solution/SKILL.md`
- `.codex/skills/adapt-from-feedback/SKILL.md`
- `.codex/skills/maintain-knowledge-base/SKILL.md`
- `.codex/skills/source-research/SKILL.md`
- `.codex/skills/goal-spec/SKILL.md`
- `.codex/skills/spec-workflow/SKILL.md`

## Boundaries

- Do not edit `ideas.md` or `tasks.md` without explicit permission.
- Do not publish secrets, private mail, keys, or unnecessary personal data.
- Keep README-first structure.
- Project hooks live only in `.codex/hooks/` and `.codex/hooks.json`.
- Local skills live only in `.codex/skills/`.
