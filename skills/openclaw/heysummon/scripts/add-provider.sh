#!/bin/bash
# HeySummon Consumer — Add/register a provider
# Usage: add-provider.sh <api-key> [alias]

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SKILL_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
SDK_DIR="${HEYSUMMON_SDK_DIR:-$(git -C "$SCRIPT_DIR" rev-parse --show-toplevel 2>/dev/null)/packages/consumer-sdk}"

[ -f "$SKILL_DIR/.env" ] && set -a && source "$SKILL_DIR/.env" && set +a

# Persist HEYSUMMON_BASE_URL to .env if provided as env prefix
if [ -n "$HEYSUMMON_BASE_URL" ]; then
  ENV_FILE="$SKILL_DIR/.env"
  if [ ! -f "$ENV_FILE" ] || ! grep -q "^HEYSUMMON_BASE_URL=" "$ENV_FILE" 2>/dev/null; then
    echo "HEYSUMMON_BASE_URL=$HEYSUMMON_BASE_URL" >> "$ENV_FILE"
  fi
fi

if [ -z "$1" ]; then
  echo "Usage: add-provider.sh <api-key> [alias]" >&2
  exit 1
fi

export HEYSUMMON_BASE_URL="${HEYSUMMON_BASE_URL:-http://localhost:3445}"
export HEYSUMMON_PROVIDERS_FILE="${HEYSUMMON_PROVIDERS_FILE:-$HOME/.heysummon/providers.json}"

CLI_ARGS=(add-provider --key "$1")
[ -n "$2" ] && CLI_ARGS+=(--alias "$2")

exec npx tsx "$SDK_DIR/src/cli.ts" "${CLI_ARGS[@]}"
