#!/bin/bash
# HeySummon — Identify the expert(s) this skill is bound to.
# Prints a concise summary per registered expert: base URL, expert name + id,
# key name, owner, is-active.
#
# Usage:
#   whoami.sh                      # all registered experts
#   whoami.sh <expert-name>        # one expert

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SKILL_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
source "$SCRIPT_DIR/sdk.sh"

[ -f "$SKILL_DIR/.env" ] && set -a && source "$SKILL_DIR/.env" && set +a

export HEYSUMMON_BASE_URL="${HEYSUMMON_BASE_URL:-http://localhost:3425}"
export HEYSUMMON_EXPERTS_FILE="${HEYSUMMON_EXPERTS_FILE:-$HOME/.heysummon/experts.json}"

print_summary() {
  local expert_name="$1"
  local json
  if ! json=$($SDK_CLI whoami --expert "$expert_name" 2>/dev/null); then
    echo "  $expert_name -- unreachable (check base URL + API key)"
    return 1
  fi

  node --input-type=module -e "
    const d = JSON.parse(process.argv[1]);
    const base = process.argv[2];
    const active = d.expert && d.expert.isActive ? 'active' : 'inactive';
    process.stdout.write(
      \`  base:    \${base}\n\` +
      \`  expert:  \${d.expert?.name ?? '(unknown)'} [\${d.expert?.id ?? '-'}] (\${active})\n\` +
      \`  key:     \${d.keyName ?? '(unnamed)'} (\${d.keyId ?? '-'})\n\` +
      \`  owner:   \${d.owner?.name ?? d.owner?.id ?? '-'}\n\`
    );
  " "$json" "$HEYSUMMON_BASE_URL"
}

if [ $# -ge 1 ] && [ -n "$1" ]; then
  echo "Expert binding:"
  print_summary "$1"
  exit $?
fi

# No args: iterate experts.json
if [ ! -f "$HEYSUMMON_EXPERTS_FILE" ]; then
  echo "No experts registered."
  echo ""
  echo "Install via the HeySummon dashboard one-liner:"
  echo "  curl -sf \"<setup-url>/command\" | jq -r '.installCommand' | bash"
  exit 0
fi

NAMES=$(node -e "
  try {
    const d = JSON.parse(require('fs').readFileSync(process.argv[1], 'utf8'));
    for (const e of (d.experts || [])) process.stdout.write(e.name + '\n');
  } catch { /* empty */ }
" "$HEYSUMMON_EXPERTS_FILE")

if [ -z "$NAMES" ]; then
  echo "No experts registered."
  exit 0
fi

COUNT=$(printf '%s\n' "$NAMES" | wc -l | tr -d ' ')
echo "Expert bindings ($COUNT):"
while IFS= read -r NAME; do
  [ -z "$NAME" ] && continue
  echo ""
  echo "- $NAME"
  print_summary "$NAME" || true
done <<< "$NAMES"
