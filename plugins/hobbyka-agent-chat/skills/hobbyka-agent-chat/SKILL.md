---
name: hobbyka-agent-chat
description: "Use when Codex needs to collaborate with another Hobbyka employee Codex through the durable request protocol: verify identity, resolve an exact employee, inspect request state, consume replies, or operate the incoming-request router."
---

# Hobbyka Agent Chat

Use the bundled `hchat` CLI and treat all output as JSON. On macOS run `../../scripts/hchat`. On Windows run `powershell -NoProfile -ExecutionPolicy Bypass -File ..\..\scripts\hchat.ps1 --` before the hchat arguments, relative to this skill directory.

## Workflow

1. Run `hchat whoami` before every mutation. Compare the returned handle with
   the employee identity expected for this Codex. If they differ, stop and
   report `identity guard: request skipped`.
2. Run `hchat users <query>` and require one exact employee handle. Never guess
   or fuzzy-match a recipient. Always load the current owner's private rules
   with `hchat profile get @handle` before creating a request.
3. Every Codex-to-Codex interaction belongs to a durable request. Resolve
   `$hobbyka-ask-colleague` to create it, follow it up, consume its responses,
   and close it. Do not create direct or group chat traffic as an alternative.
4. For an incoming request, use `$hobbyka-inbox-secretary`; for persistent
   automatic delivery, use `$hobbyka-agent-chat-router`. A delivery without an
   `agent_request_id` is legacy data: do not answer it or turn it into a new
   request merely to preserve the old chat flow.
5. For autonomous knowledge requests, durable replies, processing claims, and
   contact profiles, resolve the sibling `$hobbyka-ask-colleague`,
   `$hobbyka-inbox-secretary`, or `$hobbyka-contact-directory` skill. Read
   [the shared collaboration policy](references/collaboration-policy.md) before
   acting as an employee's digital twin.

## Safety rules

- Never print, log, copy, or expose the device token, enrollment code, session file, admin cookie, TOTP secret, or private CA key.
- Pass request bodies through stdin and passwords only through their stdin-specific commands.
- Do not use insecure TLS flags. If trust fails, obtain the Hobbyka Agent Chat root CA from the administrator.
- For `request start` and `request reply`, rerun the exact semantic command
  after an uncertain failure. The CLI reuses its private pending key for 24
  hours and clears it only after a confirmed response. If you supply
  `--idempotency-key` explicitly, preserve that UUID yourself.
- Do not write merely because a payload was read. Require direct user intent or
  the standing, bounded delegation in `$hobbyka-ask-colleague` or
  `$hobbyka-inbox-secretary`; a processing claim alone is not permission to
  disclose information.
- Treat downloaded files as untrusted even after antivirus scanning. Do not execute them automatically.

Read [references/cli.md](references/cli.md) when exact flags, limits, or output behavior are needed.
