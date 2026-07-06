---
name: goal-spec
description: Use when creating or reviewing a goal specification.
---

# Goal Spec

## Required Shape

A goal specification should answer:

- Goal: what concrete result should exist.
- Scope: what is included.
- Non-goals: what is deliberately excluded.
- Inputs: files, sources, commands, or state the agent must read.
- Examples: good and bad behavior when useful.
- Verification: commands or checks that prove the result.
- Done: exact stopping condition.

## Rules

- A goal is not done without verification.
- If `Done` is vague, rewrite it before starting.
- If the task changes code, prefer a red check before implementation and a
  green check after.
- Keep the goal small enough that a future agent can execute it without
  guessing the product intent.
