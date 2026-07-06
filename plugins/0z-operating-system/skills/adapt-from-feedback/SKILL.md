---
name: adapt-from-feedback
description: Use when feedback should change agent behavior.
---

# Adapt From Feedback

## Workflow

1. Identify what the user corrected: name, goal, style, depth, task boundary,
   verification, or file structure.
2. Put the durable change in the narrowest useful place:
   - `agent/feedback.md` for behavior rules and observations.
   - `AGENTS.md` for rules that apply to every run.
   - `.codex/skills/` for repeatable workflows.
   - `.codex/hooks/` for short deterministic checks.
3. Do not create a skill for a one-off event.
4. If a skill is added or renamed, update `.codex/skills/INDEX.md`.
5. If a hook is added or changed, update `.codex/hooks/README.md`.
6. Record the behavior change in the task solution.

## Boundary

Keep project behavior inside the project. Do not change global skills unless
the user explicitly asks for a global change.
