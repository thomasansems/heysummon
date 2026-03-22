#!/bin/bash
# HeySummon Claude Code Skill — Add/register a provider
# Usage: add-provider.sh <api-key> [alias]

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SKILL_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
SDK_DIR="${HEYSUMMON_SDK_DIR:-$(git -C "$SCRIPT_DIR" rev-parse --show-toplevel 2>/dev/null)/packages/consumer-sdk}"

[ -f "$SKILL_DIR/.env" ] && set -a && source "$SKILL_DIR/.env" && set +a

if [ -z "$1" ]; then
  echo "Usage: add-provider.sh <api-key> [alias]" >&2
  exit 1
fi

export HEYSUMMON_BASE_URL="${HEYSUMMON_BASE_URL:-http://localhost:3425}"
export HEYSUMMON_PROVIDERS_FILE="${HEYSUMMON_PROVIDERS_FILE:-$HOME/.heysummon/providers.json}"

CLI_ARGS=(add-provider --key "$1")
[ -n "$2" ] && CLI_ARGS+=(--alias "$2")

exec npx tsx "$SDK_DIR/src/cli.ts" "${CLI_ARGS[@]}"
