# Matrix Agent

Codex plugin with a Go CLI and a skill for Matrix rooms.

## CLI

```sh
cd cli
go build -o matrix-agent .
```

State lives in `MATRIX_AGENT_HOME` or the user config dir. `session.json` stores the access token with `0600`; passwords are read through `--password-stdin` and are not stored.

Commands:

```text
matrix-agent login --homeserver <url-or-host> --user <login> --password-stdin
matrix-agent whoami
matrix-agent unread --limit 20 [--from token]
matrix-agent dialogs --limit 20
matrix-agent read <room_id> --limit 50 [--from token]
matrix-agent search <room_id> <query> --limit 200
matrix-agent send <room_id> --stdin
matrix-agent join <room_id>
matrix-agent ack <room_id> [--event <event_id>]
matrix-agent logout
```

## Skill

The Codex skill is in `skills/matrix-agent/SKILL.md`.
