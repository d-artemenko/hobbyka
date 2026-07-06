# One Background Run

## Entry

1. Read `AGENTS.md`, `ideas.md`, `tasks.md`, `STATUS.md`,
   `agent/status-map.md`, `agent/attention-map.md`,
   `agent/recent-solutions-map.md`, `agent/INDEX.md`,
   `agent/feedback.md`, `agent/feedback-map.md`,
   `.codex/skills/INDEX.md`, `.codex/hooks/README.md`, and
   `agent/knowledge-model.md`.
2. Read the local skills relevant to the chosen task.
3. Choose exactly one task.
4. Create a folder in `agent/tasks/` if needed.

## Setup

When this operating system is first installed, create a recurring Codex
automation if the environment exposes automation tools. The automation should
ask the agent to run one narrow cycle, update status, run `agent/bin/check-os`,
and report the result. If automation tools are unavailable, write the blocker
and next manual command in `STATUS.md`.

## Investigation

1. Define one to five narrow research areas.
2. Use subagents for broad independent work when available.
3. Verify important findings yourself.

## Solution

1. Write or update `solution.md`.
2. Record the task, reason for choosing it, checks, findings, decision, risks,
   next step, and changed files.
3. Update status and indexes.

## Finish

1. Decide whether behavior should change after this run.
2. Update feedback, skills, or hooks if the change is durable.
3. Run `agent/bin/check-os`.
4. Commit and push when appropriate.
5. Report the result briefly.
