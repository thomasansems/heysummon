#!/bin/bash
# HeySummon Consumer — Submit a help request to the platform
# Usage: submit-request.sh "<question>" [messages-json] [provider-name]

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SKILL_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
SDK_DIR="${HEYSUMMON_SDK_DIR:-$(git -C "$SCRIPT_DIR" rev-parse --show-toplevel 2>/dev/null)/packages/consumer-sdk}"

[ -f "$SKILL_DIR/.env" ] && set -a && source "$SKILL_DIR/.env" && set +a

QUESTION="$1"
MESSAGES="${2:-}"
PROVIDER_NAME="$3"

if [ -z "$QUESTION" ]; then
  echo "Usage: submit-request.sh \"<question>\" [messages-json] [provider-name]" >&2
  exit 1
fi

# Export env vars for the CLI
export HEYSUMMON_BASE_URL="${HEYSUMMON_BASE_URL:-http://localhost:3445}"
export HEYSUMMON_API_KEY="${HEYSUMMON_API_KEY:-}"
export HEYSUMMON_PROVIDERS_FILE="${HEYSUMMON_PROVIDERS_FILE:-$HOME/.heysummon/providers.json}"
export HEYSUMMON_KEY_DIR="${HEYSUMMON_KEY_DIR:-$SKILL_DIR/.keys}"
export HEYSUMMON_REQUESTS_DIR="${HEYSUMMON_REQUESTS_DIR:-$SKILL_DIR/.requests}"

# Build CLI args
CLI_ARGS=(submit --question "$QUESTION")
[ -n "$MESSAGES" ] && [ "$MESSAGES" != "[]" ] && CLI_ARGS+=(--context "$MESSAGES")
[ -n "$PROVIDER_NAME" ] && CLI_ARGS+=(--provider "$PROVIDER_NAME")

# Run the SDK CLI
RESPONSE=$(npx tsx "$SDK_DIR/src/cli.ts" "${CLI_ARGS[@]}" 2>&1)
CLI_EXIT=$?

if [ $CLI_EXIT -ne 0 ]; then
  echo "$RESPONSE" >&2
  exit 1
fi

# Parse JSON output for display
REQUEST_ID=$(echo "$RESPONSE" | tail -1 | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{try{const j=JSON.parse(d);process.stdout.write(j.requestId||'')}catch(e){}})" 2>/dev/null)
REF_CODE=$(echo "$RESPONSE" | tail -1 | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{try{const j=JSON.parse(d);process.stdout.write(j.refCode||'')}catch(e){}})" 2>/dev/null)
PROVIDER_UNAVAILABLE=$(echo "$RESPONSE" | tail -1 | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{try{const j=JSON.parse(d);process.stdout.write(j.providerUnavailable?'true':'false')}catch(e){process.stdout.write('false')}})" 2>/dev/null)

echo "✅ Your question has been sent to the provider."
echo "🔖 Ref: $REF_CODE"

if [ "$PROVIDER_UNAVAILABLE" = "true" ]; then
  echo "⚠️  The provider is not available right now."
  echo "📬 Your request is queued and will be delivered when they come online."
else
  echo "⏳ Waiting for provider response..."
fi

# Auto-start consumer watcher if not already running
if command -v pm2 &>/dev/null; then
  PM2_STATUS=$(pm2 show heysummon-watcher 2>/dev/null | grep "status" | head -1 | awk '{print $4}')
  if [ "$PM2_STATUS" != "online" ]; then
    echo "🚀 Starting consumer watcher..."
    bash "$SCRIPT_DIR/setup.sh"
  else
    echo "📡 Consumer watcher already running"
    # Signal watcher to refresh (picks up the new request)
    WATCHER_PID=$(cat "$HEYSUMMON_REQUESTS_DIR/.watcher.pid" 2>/dev/null)
    if [ -n "$WATCHER_PID" ] && kill -0 "$WATCHER_PID" 2>/dev/null; then
      kill -USR1 "$WATCHER_PID" 2>/dev/null
    fi
  fi
else
  echo "📡 Start the watcher manually: bash $SCRIPT_DIR/setup.sh"
fi
