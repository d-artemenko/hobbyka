#!/usr/bin/env bash
set -euo pipefail

root="${1:-$(pwd)}"

required=(
  "AGENTS.md"
  "README.md"
  "ideas.md"
  "tasks.md"
  "STATUS.md"
  "agent/README.md"
  "agent/INDEX.md"
  "agent/AUTOMATION.md"
  "agent/status-map.md"
  "agent/attention-map.md"
  "agent/recent-solutions-map.md"
  "agent/feedback.md"
  "agent/feedback-map.md"
  "agent/knowledge-model.md"
  "agent/bin/README.md"
  "agent/bin/check-os"
  "agent/tasks/README.md"
  "agent/ideas/README.md"
  ".codex/skills/README.md"
  ".codex/skills/INDEX.md"
  ".codex/hooks.json"
  ".codex/hooks/README.md"
  ".codex/hooks/policy.md"
  ".codex/hooks/check-os.sh"
  "docs/README.md"
  "docs/concept.md"
  "docs/behaviour.md"
  "docs/architecture.md"
  "research/README.md"
  "research/INDEX.md"
  "research/SOURCES.md"
  "research/indexes/README.md"
  "handoff/README.md"
)

missing=0
for path in "${required[@]}"; do
  if [ ! -f "$root/$path" ]; then
    echo "Missing file: $path"
    missing=1
  fi
done
if [ "$missing" -ne 0 ]; then
  exit 1
fi

python3 -m json.tool "$root/.codex/hooks.json" >/dev/null

for skill in deep-solution adapt-from-feedback maintain-knowledge-base source-research goal-spec spec-workflow; do
  if [ ! -f "$root/.codex/skills/$skill/SKILL.md" ]; then
    echo "Missing skill: $skill"
    exit 1
  fi
done

if ! grep -q "README-first" "$root/AGENTS.md"; then
  echo "AGENTS.md must mention README-first structure."
  exit 1
fi

if ! grep -q "agent/bin/check-os" "$root/.codex/hooks/check-os.sh"; then
  echo "Hook must run agent/bin/check-os."
  exit 1
fi

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
  "$root/AGENTS.md" "$root/.codex/skills" "$root/agent" "$root/docs" "$root/research" "$root/handoff" >/tmp/0z-os-personal-check 2>/dev/null; then
  cat /tmp/0z-os-personal-check
  echo "Personal source-workspace data found in generated operating-system files."
  exit 1
fi

echo "Project operating-system check passed."
