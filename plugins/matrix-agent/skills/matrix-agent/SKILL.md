---
name: matrix-agent
description: "Use when Codex needs to inspect or send Matrix messages through the local matrix-agent CLI: check auth, list unread notifications, list recent dialogs, read or search a room, send a message, or mark a room read."
---

# Matrix Agent

Use the local `matrix-agent` CLI for Matrix work. Treat CLI output as JSON.

## Workflow

1. Start with `matrix-agent whoami`. If it is not logged in, ask for credentials or use already provided credentials with `matrix-agent login --homeserver <homeserver> --user <login> --password-stdin`.
2. Use `matrix-agent dialogs --limit 20` for room IDs and recent rooms, or `matrix-agent unread --limit 20` for unread notifications.
3. Use room IDs exactly as returned by `dialogs`; do not fuzzy-match names in v1.
4. If unread shows an `m.room.member` invite and `read` returns `M_FORBIDDEN`, accept the known room ID with `matrix-agent join <room_id>`.
5. Before replying, read context with `matrix-agent read <room_id> --limit 50`. Search within a room with `matrix-agent search <room_id> "<query>" --limit 200`.
6. Send messages with stdin: `printf '%s' "$message" | matrix-agent send <room_id> --stdin`.
7. Mark a room read only when appropriate: `matrix-agent ack <room_id> --event <event_id>`.

## Rules

- Never print or expose passwords, access tokens, or `session.json`.
- Use `--stdin` for login passwords and message bodies.
- Encrypted events with `encrypted: true` are unreadable in v1; say that honestly and do not invent content.
