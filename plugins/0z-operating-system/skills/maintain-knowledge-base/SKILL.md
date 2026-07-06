---
name: maintain-knowledge-base
description: Use when changing README indexes, folder structure, maps, or the Markdown plus git knowledge base.
---

# Maintain Knowledge Base

## Principles

1. Markdown and git are the base. Do not add a hidden database or mandatory
   external service without clear need.
2. README-first: each working directory explains itself through `README.md`.
3. A skill directory explains itself through `SKILL.md`; an extra README is not
   required there.
4. Derived maps and indexes should stay reproducible and must not become the
   only source of meaning.
5. Links should point to real files and help the next agent enter quickly.

## Lightweight Knowledge Model

Before adding a document, decide its role:

- entity: person, system, task, idea, skill;
- event: run, feedback, check, commit;
- document: README, rule, solution, skill, status.

If the role is unclear, prefer a simpler note in an existing document.

## Check

After structural changes, update `agent/INDEX.md`, relevant README files, and
`agent/knowledge-model.md` when needed. Then run `agent/bin/check-os`.

