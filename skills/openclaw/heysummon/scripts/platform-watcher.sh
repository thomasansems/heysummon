#!/bin/bash
# HeySummon Consumer Watcher — polling-based (MCP-first, no SSE/Mercure)
# Polls /api/v1/requests?status=PENDING for new incoming requests
# and notifies OpenClaw when found.

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SKILL_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
[ -f "$SKILL_DIR/.env" ] && set -a && source "$SKILL_DIR/.env" && set +a

BASE_URL="${HEYSUMMON_BASE_URL:-http://localhost:3425}"
API_KEY="${HEYSUMMON_API_KEY:?ERROR: Set HEYSUMMON_API_KEY}"
REQUESTS_DIR="${HEYSUMMON_REQUESTS_DIR:-$SKILL_DIR/.requests}"
OPENCLAW_PORT="${OPENCLAW_PORT:-18789}"
NOTIFY_MODE="${HEYSUMMON_NOTIFY_MODE:-message}"
NOTIFY_TARGET="${HEYSUMMON_NOTIFY_TARGET:-}"
POLL_INTERVAL="${HEYSUMMON_POLL_INTERVAL:-5}"

if [ "$NOTIFY_MODE" = "message" ] && [ -z "$NOTIFY_TARGET" ]; then
  echo "ERROR: Set HEYSUMMON_NOTIFY_TARGET for message mode" >&2
  exit 1
fi

# Read OpenClaw gateway token
OPENCLAW_TOKEN=$(node -e "try{const p=require('path').join(require('os').homedir(),'.openclaw/openclaw.json');console.log(JSON.parse(require('fs').readFileSync(p,'utf8')).gateway.auth.token)}catch(e){}" 2>/dev/null)

if [ -z "$OPENCLAW_TOKEN" ]; then
  echo "ERROR: Could not read OpenClaw gateway token" >&2
  exit 1
fi

mkdir -p "$REQUESTS_DIR"

# Deduplication — track seen request IDs
SEEN_FILE="$SKILL_DIR/.seen-events.txt"
touch "$SEEN_FILE"
tail -1000 "$SEEN_FILE" > "${SEEN_FILE}.tmp" 2>/dev/null && mv "${SEEN_FILE}.tmp" "$SEEN_FILE"

send_notification() {
  local MSG="$1"
  if [ "$NOTIFY_MODE" = "file" ]; then
    local EVENTS_FILE="${HEYSUMMON_EVENTS_FILE:-$HOME/.heysummon/consumer-events.jsonl}"
    mkdir -p "$(dirname "$EVENTS_FILE")"
    local TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
    echo "{\"timestamp\":\"$TIMESTAMP\",\"message\":$(node -e "console.log(JSON.stringify(process.argv[1]))" "$MSG" 2>/dev/null)}" >> "$EVENTS_FILE"
    curl -s -X POST "http://127.0.0.1:${OPENCLAW_PORT}/cron/wake" \
      -H "Authorization: Bearer ${OPENCLAW_TOKEN}" \
      -H "Content-Type: application/json" \
      -d "{\"text\":\"$MSG\",\"mode\":\"now\",\"agentId\":\"secondary\"}" \
      >/dev/null 2>&1
  else
    local PAYLOAD
    PAYLOAD=$(node -e "console.log(JSON.stringify({
      tool:'message',
      args:{action:'send',message:process.argv[1],target:process.argv[2]}
    }))" "$MSG" "$NOTIFY_TARGET" 2>/dev/null)
    curl -s "http://127.0.0.1:${OPENCLAW_PORT}/tools/invoke" \
      -H "Authorization: Bearer ${OPENCLAW_TOKEN}" \
      -H "Content-Type: application/json" \
      -d "$PAYLOAD" \
      >/dev/null 2>&1
  fi
}

echo "🦞 HeySummon watcher started (pid $$, polling every ${POLL_INTERVAL}s) → ${BASE_URL}"

while true; do
  RESPONSE=$(curl -s -H "x-api-key: ${API_KEY}" "${BASE_URL}/api/v1/requests?status=PENDING" 2>/dev/null)

  if [ -z "$RESPONSE" ]; then
    sleep "$POLL_INTERVAL"
    continue
  fi

  # Parse request IDs and refCodes
  echo "$RESPONSE" | node -e "
    let d='';
    process.stdin.on('data', c => d += c);
    process.stdin.on('end', () => {
      try {
        const { requests = [] } = JSON.parse(d);
        requests.forEach(r => {
          process.stdout.write(JSON.stringify({ id: r.id, refCode: r.refCode || r.id, question: r.question || '' }) + '\n');
        });
      } catch(e) {}
    });
  " 2>/dev/null | while IFS= read -r item; do
    REQ_ID=$(echo "$item" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{try{console.log(JSON.parse(d).id)}catch(e){}})" 2>/dev/null)
    REF_CODE=$(echo "$item" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{try{console.log(JSON.parse(d).refCode)}catch(e){}})" 2>/dev/null)
    QUESTION=$(echo "$item" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{try{const q=JSON.parse(d).question;console.log(q.length>120?q.slice(0,120)+'…':q)}catch(e){}})" 2>/dev/null)

    [ -z "$REQ_ID" ] && continue

    # Deduplication
    if grep -qF "pending:${REQ_ID}" "$SEEN_FILE" 2>/dev/null; then
      continue
    fi

    echo "pending:${REQ_ID}" >> "$SEEN_FILE"

    # Store refCode mapping for reply handler
    echo "$REF_CODE" > "$REQUESTS_DIR/$REQ_ID"

    MSG="🦞 HeySummon request from ${REF_CODE}"
    [ -n "$QUESTION" ] && MSG="${MSG}: ${QUESTION}"

    send_notification "$MSG"
    echo "📨 Notified: $MSG"
  done

  sleep "$POLL_INTERVAL"
done
