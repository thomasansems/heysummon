#!/bin/bash
# HeySummon Claude Code Skill — Ask a human
#
# Usage:
#   ask.sh "<question>"                              — Blocking poll (default)
#   ask.sh "<question>" "<context>" "<provider>"     — Blocking with context
#   ask.sh --async "<question>" [context] [provider] — Non-blocking (watcher delivers later)
#   ask.sh --check                                   — Check inbox for pending responses
#
# Returns the human's response on stdout.
# Exits 0 on success, 1 on timeout or error.

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SKILL_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
SDK_DIR="${HEYSUMMON_SDK_DIR:-$(git -C "$SCRIPT_DIR" rev-parse --show-toplevel 2>/dev/null)/packages/consumer-sdk}"

# Handle --check mode
if [ "$1" = "--check" ]; then
  exec bash "$SCRIPT_DIR/check-inbox.sh" "${@:2}"
fi

# Handle --async mode
if [ "$1" = "--async" ]; then
  shift
  exec bash "$SCRIPT_DIR/submit.sh" "$@"
fi

# Load .env
[ -f "$SKILL_DIR/.env" ] && set -a && source "$SKILL_DIR/.env" && set +a

QUESTION="$1"
CONTEXT="${2:-}"
PROVIDER_NAME="${3:-}"

if [ -z "$QUESTION" ]; then
  echo "Usage: ask.sh \"<question>\" [context] [provider-name]" >&2
  echo "       ask.sh --async \"<question>\" [context] [provider]" >&2
  echo "       ask.sh --check" >&2
  exit 1
fi

if [ -z "$HEYSUMMON_API_KEY" ]; then
  echo "HEYSUMMON_API_KEY not set. Run: bash $SCRIPT_DIR/setup.sh" >&2
  exit 1
fi

# Check inbox first — deliver any pending responses before asking a new question
INBOX_DIR="$SKILL_DIR/inbox"
if [ -d "$INBOX_DIR" ] && [ "$(find "$INBOX_DIR" -maxdepth 1 -name '*.json' 2>/dev/null | head -1)" ]; then
  echo "--- Pending responses found in inbox ---" >&2
  bash "$SCRIPT_DIR/check-inbox.sh" >&2
  echo "--- End of pending responses ---" >&2
  echo "" >&2
fi

# Build CLI args for blocking poll
CLI_ARGS=(submit-and-poll --question "$QUESTION")
[ -n "$CONTEXT" ] && CLI_ARGS+=(--context "$CONTEXT")
[ -n "$PROVIDER_NAME" ] && CLI_ARGS+=(--provider "$PROVIDER_NAME")

# Export env vars for the CLI
export HEYSUMMON_BASE_URL="${HEYSUMMON_BASE_URL:-http://localhost:3425}"
export HEYSUMMON_API_KEY
export HEYSUMMON_TIMEOUT="${HEYSUMMON_TIMEOUT:-900}"
export HEYSUMMON_POLL_INTERVAL="${HEYSUMMON_POLL_INTERVAL:-3}"
export HEYSUMMON_PROVIDERS_FILE="${HEYSUMMON_PROVIDERS_FILE:-}"

# Also save to pending/ so the watcher can pick it up if the blocking poll times out
# This is the key fix: if timeout hits, the watcher still captures the response
PENDING_DIR="$SKILL_DIR/pending"
mkdir -p "$PENDING_DIR"

# Run blocking poll, but capture the output to also track it
OUTPUT=$(npx tsx "$SDK_DIR/src/cli.ts" "${CLI_ARGS[@]}" 2>/dev/tty)
EXIT_CODE=$?

# If we got a TIMEOUT, save to pending so watcher picks it up later
if echo "$OUTPUT" | grep -q "^TIMEOUT:"; then
  # Extract request ref from the timeout message
  REF=$(echo "$OUTPUT" | grep -oP 'request \K[^\s.]+')
  # The submit-and-poll already submitted — we need the requestId
  # Parse it from stderr (already printed). Save a pending entry for the watcher.
  # Since we don't have the requestId easily, we'll use the ref code to look it up
  if [ -n "$REF" ]; then
    node -e "
      const fs = require('fs');
      const entry = {
        requestId: process.argv[1],
        refCode: process.argv[1],
        question: process.argv[2],
        provider: process.argv[3] || 'default',
        submittedAt: new Date().toISOString(),
        timedOut: true
      };
      fs.writeFileSync(process.argv[4] + '/' + entry.requestId + '.json', JSON.stringify(entry, null, 2));
    " "$REF" "$QUESTION" "$PROVIDER_NAME" "$PENDING_DIR" 2>/dev/null
    echo "   (watcher will deliver the response when it arrives)" >&2
  fi
fi

echo "$OUTPUT"
exit $EXIT_CODE
