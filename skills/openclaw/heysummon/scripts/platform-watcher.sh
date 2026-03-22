#!/bin/bash
# HeySummon Consumer Watcher — HTTP polling for pending events
# Thin wrapper around the SDK CLI watch command.
# OpenClaw-specific notification logic lives in notify.sh.

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SKILL_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
SDK_DIR="${HEYSUMMON_SDK_DIR:-$(git -C "$SCRIPT_DIR" rev-parse --show-toplevel 2>/dev/null)/packages/consumer-sdk}"

[ -f "$SKILL_DIR/.env" ] && set -a && source "$SKILL_DIR/.env" && set +a

export HEYSUMMON_BASE_URL="${HEYSUMMON_BASE_URL:-http://localhost:3445}"
export HEYSUMMON_PROVIDERS_FILE="${HEYSUMMON_PROVIDERS_FILE:-$HOME/.heysummon/providers.json}"
export HEYSUMMON_REQUESTS_DIR="${HEYSUMMON_REQUESTS_DIR:-$SKILL_DIR/.requests}"
export HEYSUMMON_POLL_INTERVAL="${HEYSUMMON_POLL_INTERVAL:-5}"

# Load API keys from providers.json (multi-provider support)
# HEYSUMMON_API_KEY is no longer used — add providers via add-provider.sh
PROVIDERS_FILE="${HEYSUMMON_PROVIDERS_FILE:-$HOME/.heysummon/providers.json}"
if [ ! -f "$PROVIDERS_FILE" ] || [ "$(node -e "try{const d=JSON.parse(require('fs').readFileSync(process.argv[1]));console.log(d.providers?.length||0)}catch(e){console.log(0)}" "$PROVIDERS_FILE" 2>/dev/null)" = "0" ]; then
  echo "❌ No providers registered. Run: bash scripts/add-provider.sh <key> \"<name>\"" >&2
  exit 1
fi
# Primary key for polling (first provider); all providers polled in loop below
API_KEY=$(node -e "try{const d=JSON.parse(require('fs').readFileSync(process.argv[1]));console.log(d.providers[0]?.apiKey||'')}catch(e){}" "$PROVIDERS_FILE" 2>/dev/null)
if [ -z "$API_KEY" ]; then
  echo "❌ Could not read API key from providers.json" >&2
  exit 1
fi
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
    if [ -n "$RESPONSE_TEXT" ]; then
      # Provider response: wake agent via /hooks/agent (no raw Telegram notification)
      # Sandy receives the response in her existing session with full context
      SESSION_KEY="${HEYSUMMON_SESSION_KEY}"
      AGENT_ID="${HEYSUMMON_AGENT_ID:-tertiary}"
      NOTIFY_CHAT="${HEYSUMMON_NOTIFY_TARGET}"
      HOOKS_TOKEN="${HEYSUMMON_HOOKS_TOKEN}"
      # Fallback: read from openclaw.json if not set in env
      if [ -z "$HOOKS_TOKEN" ]; then
        HOOKS_TOKEN=$(node -e "try{const p=require('path').join(require('os').homedir(),'.openclaw/openclaw.json');console.log(JSON.parse(require('fs').readFileSync(p,'utf8')).hooks?.token||'')}catch(e){}" 2>/dev/null)
      fi

      HOOK_PAYLOAD=$(node -e "
        const msg = process.argv[1];
        const sessionKey = process.argv[2];
        const agentId = process.argv[3];
        const to = process.argv[4];
        const payload = {
          message: msg,
          agentId: agentId,
          deliver: true,
          channel: 'telegram',
          to: to,
          wakeMode: 'now'
        };
        // Only add sessionKey if explicitly configured
        if (sessionKey) payload.sessionKey = sessionKey;
        console.log(JSON.stringify(payload));
      " "$WAKE_TEXT" "$SESSION_KEY" "$AGENT_ID" "$NOTIFY_CHAT" 2>/dev/null)

      curl -s -X POST "http://127.0.0.1:${OPENCLAW_PORT}/hooks/agent" \
        -H "Authorization: Bearer ${HOOKS_TOKEN}" \
        -H "Content-Type: application/json" \
        -d "$HOOK_PAYLOAD" \
        >/dev/null 2>&1
    else
      # Non-response events (key exchange, closed, etc.): send plain Telegram notification
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
          case 'cancelled':
            console.log('❌ Verzoek '+ref+' is geannuleerd door de provider');
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
      node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{try{const j=JSON.parse(d);const msgs=j.messages||[];const last=msgs.filter(m=>m.from==='provider').pop();if(last&&last.plaintext){console.log(last.plaintext)}else if(last&&last.iv==='plaintext'){console.log(Buffer.from(last.ciphertext,'base64').toString())}else{console.log('(encrypted)')}}catch(e){console.log('')}})" 2>/dev/null)
    if [ -n "$RESPONSE_TEXT" ]; then
      MSG="${MSG}\n💬 ${RESPONSE_TEXT}"
    fi
  fi

  if [ -n "$MSG" ]; then
    # Deduplication — include "from" so consumer send ≠ provider response
    EVENT_TYPE=$(echo "$data" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{try{console.log(JSON.parse(d).type||'?')}catch(e){console.log('?')}})" 2>/dev/null)
    EVENT_FROM=$(echo "$data" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{try{console.log(JSON.parse(d).from||'unknown')}catch(e){console.log('unknown')}})" 2>/dev/null)
    DEDUP_KEY="${EVENT_TYPE}:${EVENT_FROM}:${EVENT_REQ_ID}"

    # Age check: skip provider responses older than 30 minutes (avoids re-processing old events after restart)
    IS_STALE=$(echo "$data" | node -e "
      let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{
        try {
          const j=JSON.parse(d);
          const ts=j.createdAt||j.updatedAt||j.timestamp||null;
          if(!ts) { console.log(''); return; }
          const age=(Date.now()-new Date(ts).getTime())/1000/60; // minutes
          console.log(age>30?'yes':'');
        } catch(e){ console.log(''); }
      });
    " 2>/dev/null)
    if [ "$IS_STALE" = "yes" ]; then
      echo "$DEDUP_KEY" >> "$SEEN_FILE"
      echo "⏭️ Skip stale (>30min): $DEDUP_KEY"
    elif grep -qF "$DEDUP_KEY" "$SEEN_FILE" 2>/dev/null; then
      echo "⏭️ Skip duplicate: $DEDUP_KEY"
    else
      echo "$DEDUP_KEY" >> "$SEEN_FILE"

      # Build a rich wake message for the agent to act on
      WAKE_TEXT="HeySummon antwoord ontvangen. $MSG"
      if [ -n "$RESPONSE_TEXT" ] && [ -n "$EVENT_REQ_ID" ]; then
        # Fetch original question + provider name from HeySummon
        REQ_DATA=$(curl -s "${BASE_URL}/api/v1/requests/by-ref/${FILE_REF:-$EVENT_REQ_ID}" \
          -H "x-api-key: ${API_KEY}" 2>/dev/null)
        
        ORIGINAL_QUESTION=$(echo "$REQ_DATA" | \
          node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{try{const j=JSON.parse(d);console.log(j.question||'')}catch(e){console.log('')}})" 2>/dev/null)
        
        PROVIDER_NAME=$(echo "$REQ_DATA" | \
          node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{try{const j=JSON.parse(d);console.log(j.provider?.name||j.providerName||'de provider')}catch(e){console.log('de provider')}})" 2>/dev/null)

        WAKE_TEXT=$(node -e "
          const ref = process.argv[1];
          const q = process.argv[2];
          const ans = process.argv[3];
          const provider = process.argv[4];
          let msg = '📩 ' + ref + ' — ' + provider + ' antwoordde!';
          if (q) msg += '\n\nJouw vraag was: ' + q;
          msg += '\n\nAntwoord: ' + ans;
          msg += '\n\n**In je reactie: begin altijd met \"📩 ' + ref + '\" zodat het duidelijk is welke vraag je beantwoordt.**';
          msg += '\n\nGa nu verder op basis van dit antwoord.';
          console.log(msg);
        " "$FILE_REF" "$ORIGINAL_QUESTION" "$RESPONSE_TEXT" "$PROVIDER_NAME" 2>/dev/null)
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

# Main polling loop — polls all registered providers
while true; do
  # Reload provider keys each cycle (in case new providers were added)
  ALL_KEYS=$(node -e "try{const d=JSON.parse(require('fs').readFileSync(process.argv[1]));d.providers.forEach(p=>console.log(p.apiKey))}catch(e){}" "$PROVIDERS_FILE" 2>/dev/null)
  while IFS= read -r POLL_KEY; do
    [ -z "$POLL_KEY" ] && continue
    API_KEY="$POLL_KEY"  # update for send_ack / fetch calls within process_event
    response=$(curl -s -H "x-api-key: ${POLL_KEY}" "${PENDING_URL}" 2>/dev/null)

    if [[ -n "$response" ]]; then
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
  done <<< "$ALL_KEYS"

  sleep "$POLL_INTERVAL"
done
