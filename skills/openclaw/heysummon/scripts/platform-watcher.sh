#!/bin/bash
# HeySummon Consumer Watcher — HTTP polling for pending events
# Polls GET /api/v1/events/pending for real-time event notifications
# Listens on all active request topics automatically (server-side)

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SKILL_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
[ -f "$SKILL_DIR/.env" ] && set -a && source "$SKILL_DIR/.env" && set +a

BASE_URL="${HEYSUMMON_BASE_URL:-http://localhost:3445}"
API_KEY="${HEYSUMMON_API_KEY:?ERROR: Set HEYSUMMON_API_KEY}"
REQUESTS_DIR="${HEYSUMMON_REQUESTS_DIR:-$SKILL_DIR/.requests}"
OPENCLAW_PORT="${OPENCLAW_PORT:-18789}"
NOTIFY_MODE="${HEYSUMMON_NOTIFY_MODE:-message}"
NOTIFY_TARGET="${HEYSUMMON_NOTIFY_TARGET:-}"
PENDING_URL="${BASE_URL}/api/v1/events/pending"
ACK_URL="${BASE_URL}/api/v1/events/ack"
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

# Deduplication
SEEN_FILE="$SKILL_DIR/.seen-events.txt"
touch "$SEEN_FILE"
tail -500 "$SEEN_FILE" > "${SEEN_FILE}.tmp" 2>/dev/null && mv "${SEEN_FILE}.tmp" "$SEEN_FILE"

send_notification() {
  local MSG="$1"
  local WAKE_TEXT="${2:-$MSG}"
  if [ "$NOTIFY_MODE" = "file" ]; then
    local EVENTS_FILE="${HEYSUMMON_EVENTS_FILE:-$HOME/.heysummon/consumer-events.jsonl}"
    mkdir -p "$(dirname "$EVENTS_FILE")"
    local TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
    echo "{\"timestamp\":\"$TIMESTAMP\",\"message\":$(node -e "console.log(JSON.stringify(process.argv[1]))" "$MSG" 2>/dev/null)}" >> "$EVENTS_FILE"
    curl -s -X POST "http://127.0.0.1:${OPENCLAW_PORT}/cron/wake" \
      -H "Authorization: Bearer ${OPENCLAW_TOKEN}" \
      -H "Content-Type: application/json" \
      -d "{\"text\":\"$WAKE_TEXT\",\"mode\":\"now\",\"agentId\":\"secondary\"}" \
      >/dev/null 2>&1
  else
    # 1. Send Telegram notification
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

    # Wake the agent via sessions_send → directly into Sandy's active session
    if [ -n "$RESPONSE_TEXT" ]; then
      SESSION_KEY="${HEYSUMMON_SESSION_KEY:-agent:tertiary:telegram:group:-5080163376}"
      curl -s "http://127.0.0.1:${OPENCLAW_PORT}/tools/invoke" \
        -H "Authorization: Bearer ${OPENCLAW_TOKEN}" \
        -H "Content-Type: application/json" \
        -d "$(node -e "console.log(JSON.stringify({
          tool: 'sessions_send',
          args: {
            sessionKey: process.argv[2],
            message: process.argv[1],
            timeoutSeconds: 0
          }
        }))" "$WAKE_TEXT" "$SESSION_KEY" 2>/dev/null)" \
        >/dev/null 2>&1
    fi
  fi
}

# Send ACK for a delivered event
send_ack() {
  local request_id="$1"
  [[ -z "$request_id" ]] && return
  curl -s -X POST "${ACK_URL}/${request_id}" \
    -H "x-api-key: ${API_KEY}" \
    >/dev/null 2>&1
}

# Write PID for submit-request.sh signaling
mkdir -p "$REQUESTS_DIR"
echo $$ > "$REQUESTS_DIR/.watcher.pid"

echo "🦞 Platform watcher started (pid $$)"
echo "   Polling: ${PENDING_URL} every ${POLL_INTERVAL}s"
echo "   API key: ${API_KEY:0:15}..."

process_event() {
  local data="$1"
  [[ -z "$data" ]] && return

  # Look up refCode from active-requests file
  EVENT_REQ_ID=$(echo "$data" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{try{console.log(JSON.parse(d).requestId||'')}catch(e){console.log('')}})" 2>/dev/null)
  FILE_REF=""
  [ -n "$EVENT_REQ_ID" ] && [ -f "$REQUESTS_DIR/$EVENT_REQ_ID" ] && FILE_REF=$(cat "$REQUESTS_DIR/$EVENT_REQ_ID")

  MSG=$(echo "$data" | REF_FROM_FILE="$FILE_REF" node -e "
    let d='';
    process.stdin.on('data',c=>d+=c);
    process.stdin.on('end',()=>{
      try {
        const j=JSON.parse(d);
        const type=j.type||'unknown';
        const ref=j.refCode||process.env.REF_FROM_FILE||j.requestId||'?';
        switch(type) {
          case 'keys_exchanged':
            console.log('🔑 Key exchange voltooid voor '+ref+' — provider is verbonden');
            break;
          case 'new_message':
            if(j.from==='provider') {
              console.log('📩 Nieuw antwoord van provider voor '+ref);
            } else {
              console.log('');
            }
            break;
          case 'responded':
            console.log('📩 Provider heeft geantwoord op '+ref);
            break;
          case 'closed':
            console.log('🔒 Conversatie '+ref+' gesloten');
            break;
          default:
            console.log('🦞 HeySummon event ('+type+') voor '+ref);
        }
      } catch(e) {
        console.log('🦞 HeySummon consumer event');
      }
    });
  " 2>/dev/null)

  # For provider messages, fetch the actual response text
  IS_PROVIDER_MSG=$(echo "$data" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{try{const j=JSON.parse(d);console.log(j.type==='new_message'&&j.from==='provider'?'yes':'')}catch(e){console.log('')}})" 2>/dev/null)
  if [ "$IS_PROVIDER_MSG" = "yes" ] && [ -n "$EVENT_REQ_ID" ]; then
    RESPONSE_TEXT=$(curl -s "${BASE_URL}/api/v1/messages/${EVENT_REQ_ID}" \
      -H "x-api-key: ${API_KEY}" 2>/dev/null | \
      node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{try{const j=JSON.parse(d);const msgs=j.messages||[];const last=msgs.filter(m=>m.from==='provider').pop();if(last&&last.iv==='plaintext'){console.log(Buffer.from(last.ciphertext,'base64').toString())}else{console.log('(encrypted)')}}catch(e){console.log('')}})" 2>/dev/null)
    if [ -n "$RESPONSE_TEXT" ]; then
      MSG="${MSG}\n💬 ${RESPONSE_TEXT}"
    fi
  fi

  if [ -n "$MSG" ]; then
    # Deduplication
    EVENT_TYPE=$(echo "$data" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{try{console.log(JSON.parse(d).type||'?')}catch(e){console.log('?')}})" 2>/dev/null)
    DEDUP_KEY="${EVENT_TYPE}:${EVENT_REQ_ID}"
    if grep -qF "$DEDUP_KEY" "$SEEN_FILE" 2>/dev/null; then
      echo "⏭️ Skip duplicate: $DEDUP_KEY"
    else
      echo "$DEDUP_KEY" >> "$SEEN_FILE"

      # Build a rich wake message for the agent to act on
      WAKE_TEXT="HeySummon antwoord ontvangen. $MSG"
      if [ -n "$RESPONSE_TEXT" ]; then
        WAKE_TEXT="HeySummon provider heeft geantwoord op verzoek $FILE_REF: \"$RESPONSE_TEXT\". Verwerk dit antwoord en ga verder met de bijbehorende actie."
      fi

      send_notification "$MSG" "$WAKE_TEXT"
      echo "📨 Notified: $MSG"
    fi
  fi

  # Remove closed/expired requests
  EVENT_TYPE=$(echo "$data" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{try{console.log(JSON.parse(d).type)}catch(e){}})" 2>/dev/null)
  if [ "$EVENT_TYPE" = "closed" ] && [ -n "$EVENT_REQ_ID" ]; then
    rm -f "$REQUESTS_DIR/$EVENT_REQ_ID"
  fi

  # Send delivery ACK
  send_ack "$EVENT_REQ_ID"
}

# Main polling loop
while true; do
  response=$(curl -s -H "x-api-key: ${API_KEY}" "${PENDING_URL}" 2>/dev/null)

  if [[ -n "$response" ]]; then
    # Process each event from the response
    echo "$response" | node -e "
      let d='';
      process.stdin.on('data',c=>d+=c);
      process.stdin.on('end',()=>{
        try {
          const j=JSON.parse(d);
          for(const e of (j.events||[])) {
            console.log(JSON.stringify(e));
          }
        } catch(e){}
      });
    " 2>/dev/null | while IFS= read -r event_json; do
      process_event "$event_json"
    done
  fi

  sleep "$POLL_INTERVAL"
done
