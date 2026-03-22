#!/bin/bash
# HeySummon Consumer — Notification handler for OpenClaw
# Called by the SDK CLI watch command with event JSON on stdin.
# Handles OpenClaw hooks/agent wake and Telegram notifications.

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SKILL_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
[ -f "$SKILL_DIR/.env" ] && set -a && source "$SKILL_DIR/.env" && set +a

OPENCLAW_PORT="${OPENCLAW_PORT:-18789}"
NOTIFY_MODE="${HEYSUMMON_NOTIFY_MODE:-message}"
NOTIFY_TARGET="${HEYSUMMON_NOTIFY_TARGET:-}"

# Read event JSON from stdin
EVENT_JSON=$(cat)
MSG=$(echo "$EVENT_JSON" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{try{console.log(JSON.parse(d).msg||'')}catch(e){console.log('')}})" 2>/dev/null)
WAKE_TEXT=$(echo "$EVENT_JSON" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{try{console.log(JSON.parse(d).wakeText||'')}catch(e){console.log('')}})" 2>/dev/null)
RESPONSE_TEXT=$(echo "$EVENT_JSON" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{try{console.log(JSON.parse(d).responseText||'')}catch(e){console.log('')}})" 2>/dev/null)

[ -z "$MSG" ] && exit 0

# Read OpenClaw gateway token
OPENCLAW_TOKEN=$(node -e "try{const p=require('path').join(require('os').homedir(),'.openclaw/openclaw.json');console.log(JSON.parse(require('fs').readFileSync(p,'utf8')).gateway.auth.token)}catch(e){}" 2>/dev/null)

if [ "$NOTIFY_MODE" = "file" ]; then
  EVENTS_FILE="${HEYSUMMON_EVENTS_FILE:-$HOME/.heysummon/consumer-events.jsonl}"
  mkdir -p "$(dirname "$EVENTS_FILE")"
  TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
  echo "{\"timestamp\":\"$TIMESTAMP\",\"message\":$(node -e "console.log(JSON.stringify(process.argv[1]))" "$MSG" 2>/dev/null)}" >> "$EVENTS_FILE"
  curl -s -X POST "http://127.0.0.1:${OPENCLAW_PORT}/cron/wake" \
    -H "Authorization: Bearer ${OPENCLAW_TOKEN}" \
    -H "Content-Type: application/json" \
    -d "{\"text\":\"$WAKE_TEXT\",\"mode\":\"now\",\"agentId\":\"secondary\"}" \
    >/dev/null 2>&1
elif [ -n "$RESPONSE_TEXT" ]; then
  # Provider response: wake agent via /hooks/agent
  SESSION_KEY="${HEYSUMMON_SESSION_KEY}"
  AGENT_ID="${HEYSUMMON_AGENT_ID:-tertiary}"
  HOOKS_TOKEN="${HEYSUMMON_HOOKS_TOKEN}"
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
    if (sessionKey) payload.sessionKey = sessionKey;
    console.log(JSON.stringify(payload));
  " "$WAKE_TEXT" "$SESSION_KEY" "$AGENT_ID" "$NOTIFY_TARGET" 2>/dev/null)

  curl -s -X POST "http://127.0.0.1:${OPENCLAW_PORT}/hooks/agent" \
    -H "Authorization: Bearer ${HOOKS_TOKEN}" \
    -H "Content-Type: application/json" \
    -d "$HOOK_PAYLOAD" \
    >/dev/null 2>&1
else
  # Non-response events: send plain Telegram notification
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

echo "Notified: $MSG"
