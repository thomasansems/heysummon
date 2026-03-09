#!/bin/bash
# HeySummon Provider Watcher — polls platform for new events
# Connects to /api/v1/events/pending every 30 seconds
# On new event: sends message via OpenClaw /tools/invoke (channel-agnostic)

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SKILL_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
[ -f "$SKILL_DIR/.env" ] && set -a && source "$SKILL_DIR/.env" && set +a

BASE_URL="${HEYSUMMON_BASE_URL:-http://localhost:3456}"
API_KEY="${HEYSUMMON_API_KEY:?ERROR: Set HEYSUMMON_API_KEY}"
SEEN_FILE="$HOME/.heysummon-provider/seen-events.txt"
EVENTS_FILE="$HOME/.heysummon-provider/events.jsonl"
OPENCLAW_PORT="${OPENCLAW_PORT:-18789}"
POLL_INTERVAL="${HEYSUMMON_POLL_INTERVAL:-30}"
PENDING_URL="${BASE_URL}/api/v1/events/pending"
ACK_URL="${BASE_URL}/api/v1/events/ack"

mkdir -p "$HOME/.heysummon-provider"
touch "$SEEN_FILE"

# Trim seen-events to last 500 on startup
tail -500 "$SEEN_FILE" > "${SEEN_FILE}.tmp" 2>/dev/null && mv "${SEEN_FILE}.tmp" "$SEEN_FILE"

# Read OpenClaw gateway token
OPENCLAW_TOKEN=$(node -e "try{const p=require('path').join(require('os').homedir(),'.openclaw/openclaw.json');console.log(JSON.parse(require('fs').readFileSync(p,'utf8')).gateway.auth.token)}catch(e){}" 2>/dev/null)

if [ -z "$OPENCLAW_TOKEN" ]; then
  echo "ERROR: Could not read OpenClaw gateway token" >&2
  exit 1
fi

echo "🦞 Provider watcher started (pid $$) — polling every ${POLL_INTERVAL}s"
echo "   Endpoint: ${PENDING_URL}"
echo "   API key: ${API_KEY:0:15}..."

# Send ACK for a delivered event
send_ack() {
  local request_id="$1"
  [[ -z "$request_id" ]] && return
  curl -s -X POST "${ACK_URL}/${request_id}" \
    -H "x-api-key: ${API_KEY}" \
    >/dev/null 2>&1
}

process_event() {
  local data="$1"
  [[ -z "$data" ]] && return

  local result
  result=$(echo "$data" | node -e "
    let d='';
    process.stdin.on('data',c=>d+=c);
    process.stdin.on('end',()=>{
      try {
        const j=JSON.parse(d);
        const type=j.type||'unknown';
        const ref=j.refCode||'?';
        const id=j.requestId||j.id||'';
        const key=type+':'+id;
        const q=j.question||'';
        const from=j.from||'';
        const preview=j.messagePreview||'';
        
        let msg='🦞 HeySummon ['+ref+'] ';
        switch(type) {
          case 'new_request':
            msg+='New request';
            if(q && !q.includes('==')) msg+='\n📝 '+q;
            break;
          case 'new_message':
            // Skip echo: don't notify provider about their own sent messages
            if(from === 'provider') { console.log('{}'); return; }
            msg+='New message from consumer';
            if(preview) msg+='\n💬 '+preview.slice(0,240);
            break;
          case 'keys_exchanged':
            msg+='Key exchange complete';
            break;
          case 'closed':
            msg+='Conversation closed';
            break;
          case 'responded':
            msg+='✅ Response sent';
            break;
          default:
            msg+='Event: '+type;
        }
        console.log(JSON.stringify({key,msg,requestId:id}));
      } catch(e) {
        console.log('{}');
      }
    });
  " 2>/dev/null)

  [[ -z "$result" || "$result" == "{}" ]] && return

  local dedup_key msg request_id
  dedup_key=$(echo "$result" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{try{console.log(JSON.parse(d).key)}catch(e){}})" 2>/dev/null)
  msg=$(echo "$result" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{try{console.log(JSON.parse(d).msg)}catch(e){}})" 2>/dev/null)
  request_id=$(echo "$result" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{try{console.log(JSON.parse(d).requestId)}catch(e){}})" 2>/dev/null)

  [[ -z "$msg" ]] && return

  # Deduplication check
  if grep -qF "$dedup_key" "$SEEN_FILE" 2>/dev/null; then
    return
  fi
  echo "$dedup_key" >> "$SEEN_FILE"
  echo "$data" >> "$EVENTS_FILE"

  # Send notification via OpenClaw
  local NOTIFY_TARGET="${HEYSUMMON_NOTIFY_TARGET:?ERROR: Set HEYSUMMON_NOTIFY_TARGET}"
  local PAYLOAD
  PAYLOAD=$(node -e "console.log(JSON.stringify({
    tool:'message',
    args:{action:'send',message:process.argv[1],target:process.argv[2]}
  }))" "$msg" "$NOTIFY_TARGET" 2>/dev/null)

  curl -s "http://127.0.0.1:${OPENCLAW_PORT}/tools/invoke" \
    -H "Authorization: Bearer ${OPENCLAW_TOKEN}" \
    -H "Content-Type: application/json" \
    -d "$PAYLOAD" \
    >/dev/null 2>&1

  # Send delivery ACK
  send_ack "$request_id"

  echo "📨 Sent: $dedup_key"
}

# Main polling loop
CONSECUTIVE_ERRORS=0
while true; do
  response=$(curl -s -w "\n%{http_code}" -H "x-api-key: ${API_KEY}" "${PENDING_URL}" 2>/dev/null)
  http_code=$(echo "$response" | tail -1)
  body=$(echo "$response" | sed '$d')

  if [[ "$http_code" == "200" ]]; then
    CONSECUTIVE_ERRORS=0
    
    # Process each event
    echo "$body" | node -e "
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
    " 2>/dev/null | while IFS= read -r event; do
      [[ -n "$event" ]] && process_event "$event"
    done
  else
    CONSECUTIVE_ERRORS=$((CONSECUTIVE_ERRORS + 1))
    if [[ "$CONSECUTIVE_ERRORS" -ge 5 ]]; then
      echo "⚠️ ${CONSECUTIVE_ERRORS} consecutive poll errors (HTTP ${http_code})"
    fi
  fi

  sleep "$POLL_INTERVAL"
done
