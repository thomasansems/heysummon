#!/bin/bash
# HeySummon — Ask a human (blocking poll)
#
# Usage:
#   ask.sh "<question>"                              — Blocking poll (default)
#   ask.sh "<question>" "<context>" "<expert>"       — Blocking with context
#   ask.sh "<question>" "" "" --requires-approval    — Explicit approval request

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SKILL_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
source "$SCRIPT_DIR/sdk.sh"

# Load .env
[ -f "$SKILL_DIR/.env" ] && set -a && source "$SKILL_DIR/.env" && set +a

QUESTION="$1"
CONTEXT="${2:-}"
EXPERT_NAME="${3:-}"

if [ -z "$QUESTION" ]; then
  echo "Usage: ask.sh \"<question>\" [context] [expert-name] [--requires-approval]" >&2
  exit 1
fi

if [ -z "$HEYSUMMON_API_KEY" ]; then
  echo "HEYSUMMON_API_KEY not set. Run: bash $SCRIPT_DIR/setup.sh" >&2
  exit 1
fi

# Build CLI args for blocking poll
CLI_ARGS=(submit-and-poll --question "$QUESTION")
[ -n "$CONTEXT" ] && CLI_ARGS+=(--context "$CONTEXT")
[ -n "$EXPERT_NAME" ] && CLI_ARGS+=(--expert "$EXPERT_NAME")

# Check for explicit --requires-approval flag (positional or anywhere in args)
REQUIRES_APPROVAL=false
for arg in "$@"; do
  if [ "$arg" = "--requires-approval" ]; then
    REQUIRES_APPROVAL=true
    break
  fi
done

# Auto-detect approval intent from the question text
if [ "$REQUIRES_APPROVAL" = "false" ]; then
  if echo "$QUESTION" | grep -qiE '\b(approve|approval|permission|authorize|go[- ]?ahead|green[- ]?light|sign[- ]?off|proceed)\b'; then
    REQUIRES_APPROVAL=true
  fi
fi

if [ "$REQUIRES_APPROVAL" = "true" ]; then
  CLI_ARGS+=(--requires-approval)
fi

# Export env vars for the CLI
export HEYSUMMON_BASE_URL="${HEYSUMMON_BASE_URL:-http://localhost:3425}"
export HEYSUMMON_API_KEY
export HEYSUMMON_TIMEOUT="${HEYSUMMON_TIMEOUT:-900}"
export HEYSUMMON_POLL_INTERVAL="${HEYSUMMON_POLL_INTERVAL:-3}"
export HEYSUMMON_EXPERTS_FILE="${HEYSUMMON_EXPERTS_FILE:-}"

# Run blocking poll — the CLI handles timeout reporting to the server
OUTPUT=$($SDK_CLI "${CLI_ARGS[@]}" 2>&2)
EXIT_CODE=$?

echo "$OUTPUT"
exit $EXIT_CODE
