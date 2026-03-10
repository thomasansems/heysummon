#!/bin/bash
# HeySummon Provider Watcher — HTTP polling for pending events
# Polls GET /api/v1/events/pending every 5 seconds
# On new event: sends message via OpenClaw /tools/invoke (channel-agnostic)

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SKILL_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
[ -f "$SKILL_DIR/.env" ] && set -a && source "$SKILL_DIR/.env" && set +a

BASE_URL="${HEYSUMMON_BASE_URL:-http://localhost:3456}"
API_KEY="${HEYSUMMON_API_KEY:?ERROR: Set HEYSUMMON_API_KEY}"
SEEN_FILE="$HOME/.heysummon-provider/seen-events.txt"
EVENTS_FILE="$HOME/.heysummon-provider/events.jsonl"
OPENCLAW_PORT="${OPENCLAW_PORT:-18789}"
PENDING_URL="${BASE_URL}/api/v1/events/pending"
ACK_URL="${BASE_URL}/api/v1/events/ack"
POLL_INTERVAL="${HEYSUMMON_POLL_INTERVAL:-5}"
DEBUG="${DEBUG:-false}"

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

echo "🦞 Provider watcher started (pid $$)"
echo "   Polling: ${PENDING_URL} every ${POLL_INTERVAL}s"
echo "   API key: ${API_KEY:0:15}..."
[ "$DEBUG" = "true" ] && echo "   DEBUG mode: ON"

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

  # Parse and deduplicate using node
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
        const qPreview=j.questionPreview||'';
        const needsApproval=j.requiresApproval||false;

        let msg='🦞 HeySummon ['+ref+'] ';
        switch(type) {
          case 'new_request':
            msg+='New request';
            if(needsApproval) msg+='\n🗳️ Approval needed';
            if(qPreview) msg+='\n📝 '+qPreview;
            else if(q && !q.includes('==')) msg+='\n📝 '+q;
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
        console.log(JSON.stringify({key,msg}));
      } catch(e) {
        console.log('{}');
      }
    });
  " 2>/dev/null)

  [[ -z "$result" || "$result" == "{}" ]] && return

  local dedup_key msg
  dedup_key=$(echo "$result" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{try{console.log(JSON.parse(d).key)}catch(e){}})" 2>/dev/null)
  msg=$(echo "$result" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{try{console.log(JSON.parse(d).msg)}catch(e){}})" 2>/dev/null)

  [[ -z "$msg" ]] && return

  # Deduplication check
  if grep -qF "$dedup_key" "$SEEN_FILE" 2>/dev/null; then
    return
  fi
  echo "$dedup_key" >> "$SEEN_FILE"
  echo "$data" >> "$EVENTS_FILE"

  if [ "$DEBUG" = "true" ]; then
    echo "[DEBUG] Event received:" >&2
    echo "$data" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{try{const j=JSON.parse(d);console.error(JSON.stringify(j,null,2))}catch(e){}})" 2>&1 >&2
  fi

  # Determine if this is an approval request (use refCode for callback so reply-handler.sh works directly)
  local needs_approval ref_code_for_buttons
  needs_approval=$(echo "$data" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{try{const j=JSON.parse(d);console.log(j.requiresApproval?'true':'false')}catch(e){console.log('false')}})" 2>/dev/null)
  ref_code_for_buttons=$(echo "$data" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{try{console.log(JSON.parse(d).refCode||'')}catch(e){console.log('')}})" 2>/dev/null)

  # Send notification via OpenClaw
  local NOTIFY_TARGET="${HEYSUMMON_NOTIFY_TARGET:?ERROR: Set HEYSUMMON_NOTIFY_TARGET}"
  local PAYLOAD
  if [ "$needs_approval" = "true" ] && [ -n "$ref_code_for_buttons" ]; then
    # Send with native Telegram Approve / Deny inline buttons
    # callback_data format: hs:approve:HS-XXXX or hs:deny:HS-XXXX
    PAYLOAD=$(node -e "
      const msg=process.argv[1];
      const target=process.argv[2];
      const ref=process.argv[3];
      console.log(JSON.stringify({
        tool:'message',
        args:{
          action:'send',
          message:msg,
          target:target,
          buttons:[[
            {text:'✅ Approve',callback_data:'hs:approve:'+ref},
            {text:'❌ Deny',   callback_data:'hs:deny:'+ref}
          ]]
        }
      }));
    " "$msg" "$NOTIFY_TARGET" "$ref_code_for_buttons" 2>/dev/null)
  else
    PAYLOAD=$(node -e "console.log(JSON.stringify({
      tool:'message',
      args:{action:'send',message:process.argv[1],target:process.argv[2]}
    }))" "$msg" "$NOTIFY_TARGET" 2>/dev/null)
  fi

  if [ "$DEBUG" = "true" ]; then
    echo "[DEBUG] Sending to OpenClaw:" >&2
    echo "$PAYLOAD" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{try{const j=JSON.parse(d);console.error(JSON.stringify(j,null,2))}catch(e){}})" 2>&1 >&2
    echo "[DEBUG] Message for provider: $msg" >&2
  fi

  curl -s "http://127.0.0.1:${OPENCLAW_PORT}/tools/invoke" \
    -H "Authorization: Bearer ${OPENCLAW_TOKEN}" \
    -H "Content-Type: application/json" \
    -d "$PAYLOAD" \
    >/dev/null 2>&1

  # Send delivery ACK
  local request_id
  request_id=$(echo "$data" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{try{console.log(JSON.parse(d).requestId||'')}catch(e){console.log('')}})" 2>/dev/null)
  send_ack "$request_id"

  echo "📨 Sent: $dedup_key"
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
