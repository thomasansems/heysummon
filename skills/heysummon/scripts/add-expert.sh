#!/bin/bash
# HeySummon — Add/register an expert
# Usage: add-expert.sh <api-key> [alias]

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SKILL_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
source "$SCRIPT_DIR/sdk.sh"

[ -f "$SKILL_DIR/.env" ] && set -a && source "$SKILL_DIR/.env" && set +a

# Persist HEYSUMMON_BASE_URL to .env if provided as env prefix
if [ -n "$HEYSUMMON_BASE_URL" ]; then
  ENV_FILE="$SKILL_DIR/.env"
  if [ ! -f "$ENV_FILE" ] || ! grep -q "^HEYSUMMON_BASE_URL=" "$ENV_FILE" 2>/dev/null; then
    echo "HEYSUMMON_BASE_URL=$HEYSUMMON_BASE_URL" >> "$ENV_FILE"
  fi
fi

if [ -z "$1" ]; then
  echo "Usage: add-expert.sh <api-key> [alias]" >&2
  exit 1
fi

export HEYSUMMON_BASE_URL="${HEYSUMMON_BASE_URL:-http://localhost:3425}"
export HEYSUMMON_EXPERTS_FILE="${HEYSUMMON_EXPERTS_FILE:-$HOME/.heysummon/experts.json}"

CLI_ARGS=(add-expert --key "$1")
[ -n "$2" ] && CLI_ARGS+=(--alias "$2")

exec $SDK_CLI "${CLI_ARGS[@]}"
