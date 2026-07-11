# Hobbyka Commercial Offers

A dependency-free Node.js CLI and Codex skill for creating and viewing Hobbyka commercial offers.

```bash
node skills/manage-commercial-offers/scripts/hobbyka-commercial-offers.mjs config-check
node skills/manage-commercial-offers/scripts/hobbyka-commercial-offers.mjs self-test
node skills/manage-commercial-offers/scripts/hobbyka-commercial-offers.mjs view 14891864-1-1 --check
```

Creation accepts repeated `--item ID:QUANTITY` flags or the original API JSON through `--input` and `--stdin`. Run `create --dry-run` first; live creation requires `--yes`.

No token is required. Customer contact data is sent only to `hobbyka.ru` and is excluded from the local history.
