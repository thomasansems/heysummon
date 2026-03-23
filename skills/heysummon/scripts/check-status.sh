#!/bin/bash
# HeySummon — Check request status
# Usage: check-status.sh <refCode|requestId>

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SKILL_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
source "$SCRIPT_DIR/sdk.sh"

[ -f "$SKILL_DIR/.env" ] && set -a && source "$SKILL_DIR/.env" && set +a

if [ -z "$1" ]; then
  echo "Usage: check-status.sh <refCode|requestId>"
  exit 1
fi

export HEYSUMMON_BASE_URL="${HEYSUMMON_BASE_URL:-http://localhost:3425}"
export HEYSUMMON_API_KEY="${HEYSUMMON_API_KEY:-}"

# Fallback: use first provider key if no API_KEY
if [ -z "$HEYSUMMON_API_KEY" ]; then
  PROVIDERS_FILE="${HEYSUMMON_PROVIDERS_FILE:-$HOME/.heysummon/providers.json}"
  if [ -f "$PROVIDERS_FILE" ]; then
    export HEYSUMMON_API_KEY=$(node -e "try{const d=JSON.parse(require('fs').readFileSync(process.argv[1]));console.log(d.providers[0]?.apiKey||'')}catch(e){}" "$PROVIDERS_FILE" 2>/dev/null)
  fi
fi

exec $SDK_CLI check-status --ref "$1"
