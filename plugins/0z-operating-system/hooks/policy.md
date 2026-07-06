# Hook Policy

## Allowed

- Check structure, links, JSON shape, and missing README files.
- Run deterministic commands without secrets.
- Point to a concrete fix when a check fails.

## Not Allowed

- Print secrets or local private data.
- Send data over the network.
- Rewrite `ideas.md`, `tasks.md`, `STATUS.md`, `AGENTS.md`, or solution files.
- Hide important workflow logic inside a hook.

