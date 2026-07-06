#!/usr/bin/env bash
set -euo pipefail

plugin_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

python3 -m json.tool "$plugin_root/.codex-plugin/plugin.json" >/dev/null
python3 -m json.tool "$plugin_root/hooks.json" >/dev/null

required=(
  "README.md"
  "LICENSE"
  ".codex-plugin/plugin.json"
  "scripts/install-os.sh"
  "scripts/check-os.sh"
  "scripts/validate.sh"
  "hooks/check-os.sh"
  "hooks/README.md"
  "hooks/policy.md"
  "hooks.json"
  "templates/AGENTS.md"
  "templates/STATUS.md"
  "templates/agent/INDEX.md"
  "templates/research/SOURCES.md"
)

for path in "${required[@]}"; do
  if [ ! -f "$plugin_root/$path" ]; then
    echo "Missing plugin file: $path"
    exit 1
  fi
done

for skill in deep-solution adapt-from-feedback maintain-knowledge-base source-research goal-spec spec-workflow operating-system-install; do
  if [ ! -f "$plugin_root/skills/$skill/SKILL.md" ]; then
    echo "Missing plugin skill: $skill"
    exit 1
  fi
done

old_user_1="Да"
old_user_2="ня"
old_name_1="Ар"
old_name_2="дан"
old_path="/Users/ard""anila"
old_project="hobbyka""-agent"
deepseek_key="DEEPSEEK""_API_KEY"
openai_key="OPENAI""_API_KEY"
secret_prefix="sk""-[A-Za-z0-9]"
personal_pattern="${old_user_1}${old_user_2}|${old_name_1}${old_name_2}|${old_path}|${old_project}|${deepseek_key}|${openai_key}|${secret_prefix}"

if grep -RInE "$personal_pattern" \
  "$plugin_root/README.md" "$plugin_root/skills" "$plugin_root/templates" "$plugin_root/hooks" "$plugin_root/scripts" >/tmp/0z-plugin-personal-check 2>/dev/null; then
  cat /tmp/0z-plugin-personal-check
  echo "Personal source-workspace data found in plugin."
  exit 1
fi

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
mkdir -p "$tmp/project"
"$plugin_root/scripts/install-os.sh" --target "$tmp/project" >/tmp/0z-plugin-install-check
"$tmp/project/agent/bin/check-os" "$tmp/project" >/tmp/0z-plugin-os-check

echo "0z operating-system plugin validation passed."
