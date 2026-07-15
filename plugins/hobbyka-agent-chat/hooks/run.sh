#!/bin/sh

# Hooks must never delay or break the active Codex task. The CLI owns JSON
# encoding and returns no output when there is no collaboration context.
event=${1:-}
case "$event" in
  session-start|post-tool-use) ;;
  *) exit 0 ;;
esac

thread=${CODEX_THREAD_ID:-}
[ -n "$thread" ] || exit 0

root=${PLUGIN_ROOT:-$(CDPATH= cd -- "$(dirname -- "$0")/.." 2>/dev/null && pwd)}
cli="$root/scripts/hchat"
[ -x "$cli" ] || exit 0

output=$("$cli" hook "$event" --thread "$thread" 2>/dev/null) || exit 0
[ -z "$output" ] || printf '%s\n' "$output"
exit 0
