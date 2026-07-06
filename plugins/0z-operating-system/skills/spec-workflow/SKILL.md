---
name: spec-workflow
description: Use when working from a specification through examples, checks, implementation, review, and trajectory notes.
---

# Spec Workflow

## Flow

1. Read the goal specification.
2. Add or inspect examples for expected behavior.
3. Add a failing check before changing implementation when the task is code.
4. Make the smallest useful change.
5. Run the checks named in the specification.
6. Review drift: compare changed files to `Scope`, `Non-goals`, `Verification`,
   and `Done`.
7. Write a trajectory note: expected path, actual deviation, correction, and
   next risk.

## Review Questions

- Did the work prove the goal, or only create a plausible artifact?
- Did implementation drift into a non-goal?
- Are checks empty, skipped, or disconnected from the real behavior?
- Is there a clear next action if the goal is still open?

