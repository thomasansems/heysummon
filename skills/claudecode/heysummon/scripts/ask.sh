#!/bin/bash
# HeySummon Claude Code Skill — Ask a human (blocking poll)
#
# Usage:
#   ask.sh "<question>"
#   ask.sh "<question>" "<context>" "<provider-name>"
#
# Returns the human's response on stdout.
# Exits 0 on success, 1 on timeout or error.

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SKILL_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
SDK_DIR="${HEYSUMMON_SDK_DIR:-$(git -C "$SCRIPT_DIR" rev-parse --show-toplevel 2>/dev/null)/packages/consumer-sdk}"

# Load .env
[ -f "$SKILL_DIR/.env" ] && set -a && source "$SKILL_DIR/.env" && set +a

QUESTION="$1"
CONTEXT="${2:-}"
PROVIDER_NAME="${3:-}"

if [ -z "$QUESTION" ]; then
  echo "Usage: ask.sh \"<question>\" [context] [provider-name]" >&2
  exit 1
fi

if [ -z "$HEYSUMMON_API_KEY" ]; then
  echo "HEYSUMMON_API_KEY not set. Run: bash $SCRIPT_DIR/setup.sh" >&2
  exit 1
fi

# Build CLI args
CLI_ARGS=(submit-and-poll --question "$QUESTION")
[ -n "$CONTEXT" ] && CLI_ARGS+=(--context "$CONTEXT")
[ -n "$PROVIDER_NAME" ] && CLI_ARGS+=(--provider "$PROVIDER_NAME")

# Export env vars for the CLI
export HEYSUMMON_BASE_URL="${HEYSUMMON_BASE_URL:-http://localhost:3425}"
export HEYSUMMON_API_KEY
export HEYSUMMON_TIMEOUT="${HEYSUMMON_TIMEOUT:-900}"
export HEYSUMMON_POLL_INTERVAL="${HEYSUMMON_POLL_INTERVAL:-3}"
export HEYSUMMON_PROVIDERS_FILE="${HEYSUMMON_PROVIDERS_FILE:-}"

exec npx tsx "$SDK_DIR/src/cli.ts" "${CLI_ARGS[@]}"
