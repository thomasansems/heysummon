#!/bin/bash
# HeySummon Claude Code Skill — Submit a question (non-blocking)
#
# Usage:
#   submit.sh "<question>" [context] [provider-name]
#
# Submits the request and saves it to pending/ for the watcher to track.
# Returns immediately with the request ID and ref code.
# The watcher (PM2) will write the response to inbox/ when it arrives.

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SKILL_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
SDK_DIR="${HEYSUMMON_SDK_DIR:-$(git -C "$SCRIPT_DIR" rev-parse --show-toplevel 2>/dev/null)/packages/consumer-sdk}"

# Load .env
[ -f "$SKILL_DIR/.env" ] && set -a && source "$SKILL_DIR/.env" && set +a

QUESTION="$1"
CONTEXT="${2:-}"
PROVIDER_NAME="${3:-}"

if [ -z "$QUESTION" ]; then
  echo "Usage: submit.sh \"<question>\" [context] [provider-name]" >&2
  exit 1
fi

if [ -z "$HEYSUMMON_API_KEY" ]; then
  echo "HEYSUMMON_API_KEY not set. Run: bash $SCRIPT_DIR/setup.sh" >&2
  exit 1
fi

# Build CLI args
CLI_ARGS=(submit --question "$QUESTION")
[ -n "$CONTEXT" ] && CLI_ARGS+=(--context "$CONTEXT")
[ -n "$PROVIDER_NAME" ] && CLI_ARGS+=(--provider "$PROVIDER_NAME")

# Export env vars for the CLI
export HEYSUMMON_BASE_URL="${HEYSUMMON_BASE_URL:-http://localhost:3425}"
export HEYSUMMON_API_KEY
export HEYSUMMON_PROVIDERS_FILE="${HEYSUMMON_PROVIDERS_FILE:-}"

# Run submit (non-blocking, returns JSON on stdout)
RESPONSE=$(npx tsx "$SDK_DIR/src/cli.ts" "${CLI_ARGS[@]}" 2>/dev/null)
CLI_EXIT=$?

if [ $CLI_EXIT -ne 0 ]; then
  echo "Failed to submit request" >&2
  echo "$RESPONSE" >&2
  exit 1
fi

# Parse response
REQUEST_ID=$(echo "$RESPONSE" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{try{process.stdout.write(JSON.parse(d).requestId||'')}catch(e){}})" 2>/dev/null)
REF_CODE=$(echo "$RESPONSE" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{try{process.stdout.write(JSON.parse(d).refCode||'')}catch(e){}})" 2>/dev/null)
PROVIDER_UNAVAILABLE=$(echo "$RESPONSE" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{try{process.stdout.write(JSON.parse(d).providerUnavailable?'true':'false')}catch(e){process.stdout.write('false')}})" 2>/dev/null)

if [ -z "$REQUEST_ID" ]; then
  echo "Failed to submit request: $RESPONSE" >&2
  exit 1
fi

if [ "$PROVIDER_UNAVAILABLE" = "true" ]; then
  echo "PROVIDER_UNAVAILABLE: No human available right now. Try again later."
  exit 0
fi

# Save to pending/ for the watcher to track
PENDING_DIR="$SKILL_DIR/pending"
mkdir -p "$PENDING_DIR"

node -e "
  const fs = require('fs');
  const entry = {
    requestId: process.argv[1],
    refCode: process.argv[2],
    question: process.argv[3],
    provider: process.argv[4] || 'default',
    submittedAt: new Date().toISOString()
  };
  fs.writeFileSync(process.argv[5] + '/' + entry.requestId + '.json', JSON.stringify(entry, null, 2));
" "$REQUEST_ID" "$REF_CODE" "$QUESTION" "$PROVIDER_NAME" "$PENDING_DIR"

echo "Submitted ${REF_CODE:-$REQUEST_ID} — watcher will deliver the response."
echo "   Check later: bash $SCRIPT_DIR/check-inbox.sh"
exit 0
