#!/bin/bash
# HeySummon Consumer — Check request status
# Usage: check-status.sh <request-id>

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SKILL_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
SDK_DIR="${HEYSUMMON_SDK_DIR:-$(git -C "$SCRIPT_DIR" rev-parse --show-toplevel 2>/dev/null)/packages/consumer-sdk}"

[ -f "$SKILL_DIR/.env" ] && set -a && source "$SKILL_DIR/.env" && set +a

if [ -z "$1" ]; then
  echo "Usage: check-status.sh <request-id>"
  exit 1
fi

export HEYSUMMON_BASE_URL="${HEYSUMMON_BASE_URL:-http://localhost:3445}"
export HEYSUMMON_API_KEY="${HEYSUMMON_API_KEY:-}"

# If no API_KEY in env, try first provider from providers.json
if [ -z "$HEYSUMMON_API_KEY" ]; then
  PROVIDERS_FILE="${HEYSUMMON_PROVIDERS_FILE:-$HOME/.heysummon/providers.json}"
  if [ -f "$PROVIDERS_FILE" ]; then
    export HEYSUMMON_API_KEY=$(node -e "try{const d=JSON.parse(require('fs').readFileSync(process.argv[1]));console.log(d.providers[0]?.apiKey||'')}catch(e){}" "$PROVIDERS_FILE" 2>/dev/null)
  fi
fi

exec npx tsx "$SDK_DIR/src/cli.ts" check-status --ref "$1"
