# Integration Discovery

Use integrations only after local discovery. Prefer installed skills, plugin
docs, and CLI adapters before adding dependencies.

## Search Skills

Use `https://www.skills.sh/` to search for skills by topic: `telegram`, `mail`,
`crm`, `1c`, `calendar`, `notion`, `google`, `lark`, `whatsapp`, `slack`,
`discord`, or a project-specific service name.

When the user approves a skill, install it with:

```bash
npx skills add <owner/repo>
```

Before installing anything, inspect local options:

```bash
find . ~/.codex/skills ~/.codex/plugins/cache ~/code \( -iname '*telegram*' -o -iname '*mail*' -o -iname '*crm*' -o -iname '*1c*' \) 2>/dev/null
command -v telegram || true
command -v amocrm || true
command -v 1c || true
```

## Recommended Areas

- Mail: mailbox triage, outbound drafts, notification summaries.
- Telegram and messengers: source monitoring, personal notifications, command
  intake, status reporting.
- CRM: inspect local repos and CLIs first; connect only through explicit
  credentials and safe read-only probes before writes.
- 1C/accounting: prefer existing export/import CLIs or documented API adapters.
- Calendars, docs, storage, issue trackers, analytics, and project-specific
  tools: recommend when they reduce repeated manual coordination.

## Rule

Do not claim an integration exists until `https://www.skills.sh/` or a direct
local check finds a skill, plugin doc, repository, CLI, or clear install path.
