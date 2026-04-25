#!/bin/bash
# HeySummon — Check request status
# Usage: check-status.sh <refCode|requestId>

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SKILL_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
source "$SCRIPT_DIR/sdk.sh"
source "$SCRIPT_DIR/_lib.sh"

if [ -z "$1" ]; then
  echo "Usage: check-status.sh <refCode|requestId>"
  exit 1
fi

export HEYSUMMON_BASE_URL="${HEYSUMMON_BASE_URL:-http://localhost:3425}"
export HEYSUMMON_API_KEY="${HEYSUMMON_API_KEY:-}"

# Fallback: use first expert key if no API_KEY
if [ -z "$HEYSUMMON_API_KEY" ]; then
  EXPERTS_FILE="${HEYSUMMON_EXPERTS_FILE:-$HOME/.heysummon/experts.json}"
  if [ -f "$EXPERTS_FILE" ]; then
    export HEYSUMMON_API_KEY=$(node -e "try{const d=JSON.parse(require('fs').readFileSync(process.argv[1]));console.log(d.experts[0]?.apiKey||'')}catch(e){}" "$EXPERTS_FILE" 2>/dev/null)
  fi
fi

exec $SDK_CLI check-status --ref "$1"
