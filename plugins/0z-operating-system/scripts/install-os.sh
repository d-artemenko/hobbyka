#!/usr/bin/env bash
set -euo pipefail

target=""
force=0

while [ "$#" -gt 0 ]; do
  case "$1" in
    --target)
      target="${2:-}"
      shift 2
      ;;
    --force)
      force=1
      shift
      ;;
    *)
      echo "Usage: $0 --target <project-root> [--force]" >&2
      exit 2
      ;;
  esac
done

if [ -z "$target" ]; then
  target="$(pwd)"
fi

plugin_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
target="$(cd "$target" && pwd)"

write_file() {
  local src="$1"
  local dst="$2"
  if [ -e "$dst" ] && [ "$force" -ne 1 ]; then
    echo "Keeping existing file: ${dst#$target/}"
    return
  fi
  mkdir -p "$(dirname "$dst")"
  cp "$src" "$dst"
}

copy_dir() {
  local src="$1"
  local dst="$2"
  mkdir -p "$dst"
  find "$src" -type f | while IFS= read -r file; do
    local rel="${file#$src/}"
    write_file "$file" "$dst/$rel"
  done
}

copy_dir "$plugin_root/templates" "$target"
copy_dir "$plugin_root/skills" "$target/.codex/skills"
copy_dir "$plugin_root/hooks" "$target/.codex/hooks"
write_file "$plugin_root/hooks.json" "$target/.codex/hooks.json"
write_file "$plugin_root/scripts/check-os.sh" "$target/agent/bin/check-os"
chmod +x "$target/agent/bin/check-os" "$target/.codex/hooks/check-os.sh"

"$target/agent/bin/check-os" "$target"

echo "Installed 0z operating system into $target"
