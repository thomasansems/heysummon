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

# API key can come from .env (HEYSUMMON_API_KEY) OR from the registered experts
# file (HEYSUMMON_EXPERTS_FILE). The platform-managed install persists the key
# in experts.json rather than .env, so only fail if neither source is available.
_EXPERTS_FILE="${HEYSUMMON_EXPERTS_FILE:-$HOME/.heysummon/experts.json}"
if [ -z "$HEYSUMMON_API_KEY" ] && [ ! -s "$_EXPERTS_FILE" ]; then
  echo "No API key available. Either set HEYSUMMON_API_KEY or register an expert via:" >&2
  echo "  bash $SCRIPT_DIR/setup.sh" >&2
  echo "  bash $SCRIPT_DIR/add-expert.sh <api-key> [alias]" >&2
  exit 1
fi

# Build CLI args for blocking poll
CLI_ARGS=(submit-and-poll --question "$QUESTION")
[ -n "$CONTEXT" ] && CLI_ARGS+=(--context "$CONTEXT")
[ -n "$EXPERT_NAME" ] && CLI_ARGS+=(--expert "$EXPERT_NAME")

# Forward --requires-approval flag if explicitly passed (no auto-detection)
for arg in "$@"; do
  if [ "$arg" = "--requires-approval" ]; then
    CLI_ARGS+=(--requires-approval)
    break
  fi
done

# Export env vars for the CLI
export HEYSUMMON_BASE_URL="${HEYSUMMON_BASE_URL:-http://localhost:3425}"
export HEYSUMMON_API_KEY
export HEYSUMMON_TIMEOUT="${HEYSUMMON_TIMEOUT:-900}"
export HEYSUMMON_POLL_INTERVAL="${HEYSUMMON_POLL_INTERVAL:-3}"
export HEYSUMMON_TIMEOUT_FALLBACK="${HEYSUMMON_TIMEOUT_FALLBACK:-proceed_cautiously}"
export HEYSUMMON_EXPERTS_FILE="${HEYSUMMON_EXPERTS_FILE:-}"

# Run blocking poll — the CLI handles timeout reporting to the server
OUTPUT=$($SDK_CLI "${CLI_ARGS[@]}" 2>&2)
EXIT_CODE=$?

echo "$OUTPUT"
exit $EXIT_CODE
