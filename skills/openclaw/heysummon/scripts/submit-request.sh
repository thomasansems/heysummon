#!/bin/bash
# HeySummon Consumer — Submit a help request to the platform
# Usage: submit-request.sh "<question>" [messages-json] [provider-name]
#
# Examples:
#   submit-request.sh "How do I configure X?" '[{"role":"user","content":"help me"}]'

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SKILL_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
[ -f "$SKILL_DIR/.env" ] && set -a && source "$SKILL_DIR/.env" && set +a

BASE_URL="${HEYSUMMON_BASE_URL:-http://localhost:3445}"
KEY_DIR="${HEYSUMMON_KEY_DIR:-$SKILL_DIR/.keys}"
REQUESTS_DIR="${HEYSUMMON_REQUESTS_DIR:-$SKILL_DIR/.requests}"
PROVIDERS_FILE="${HEYSUMMON_PROVIDERS_FILE:-$HOME/.heysummon/providers.json}"
CRYPTO="$SCRIPT_DIR/crypto.mjs"

QUESTION="$1"
MESSAGES="${2:-[]}"
PROVIDER_NAME="$3"

if [ -z "$QUESTION" ]; then
  echo "❌ Usage: submit-request.sh \"<question>\" [messages-json] [provider-name]" >&2
  exit 1
fi

# Resolve API key — from provider name or fallback to env
API_KEY=""
RESOLVED_PROVIDER=""

if [ -n "$PROVIDER_NAME" ] && [ -f "$PROVIDERS_FILE" ]; then
  # Look up provider by name (case-insensitive)
  PROVIDER_LOWER=$(echo "$PROVIDER_NAME" | tr '[:upper:]' '[:lower:]')
  API_KEY=$(node -e "
    const fs = require('fs');
    const data = JSON.parse(fs.readFileSync(process.argv[1], 'utf8'));
    const search = process.argv[2].toLowerCase();
    const match = data.providers.find(p => 
      p.nameLower === search || 
      p.providerName.toLowerCase() === search ||
      p.name.toLowerCase().includes(search) ||
      p.providerName.toLowerCase().includes(search)
    );
    if (match) {
      console.log(match.apiKey);
      process.stderr.write(match.name);
    }
  " "$PROVIDERS_FILE" "$PROVIDER_NAME" 2>"/tmp/.heysummon-provider-match")
  RESOLVED_PROVIDER=$(cat /tmp/.heysummon-provider-match 2>/dev/null)
  rm -f /tmp/.heysummon-provider-match
fi

# If no provider specified, use the first registered provider as default
if [ -z "$API_KEY" ]; then
  if [ -n "$PROVIDER_NAME" ]; then
    echo "⚠️ Provider '$PROVIDER_NAME' not found in providers.json" >&2
    if [ -f "$PROVIDERS_FILE" ]; then
      echo "📋 Available providers:" >&2
      node -e "
        const fs = require('fs');
        const data = JSON.parse(fs.readFileSync(process.argv[1], 'utf8'));
        data.providers.forEach(p => console.error('  - ' + p.name + ' (' + p.providerName + ')'));
      " "$PROVIDERS_FILE" 2>&1 >&2
    fi
    exit 1
  fi

  # Use first provider from providers.json as default
  if [ -f "$PROVIDERS_FILE" ]; then
    API_KEY=$(node -e "try{const d=JSON.parse(require('fs').readFileSync(process.argv[1]));const p=d.providers[0];if(p){process.stderr.write(p.name);console.log(p.apiKey)}}catch(e){}" "$PROVIDERS_FILE" 2>"/tmp/.hs-default-provider")
    RESOLVED_PROVIDER=$(cat /tmp/.hs-default-provider 2>/dev/null)
    rm -f /tmp/.hs-default-provider
  fi
fi

if [ -z "$API_KEY" ]; then
  echo "❌ No providers registered. Run: bash scripts/add-provider.sh <key> \"<name>\"" >&2
  exit 1
fi

if [[ ! "$API_KEY" =~ ^(hs_cli_|htl_cli_|htl_) ]] || [[ "$API_KEY" =~ ^(hs_prov_|htl_prov_) ]]; then
  echo "❌ Invalid key: must start with 'hs_cli_' (not a provider key)." >&2
  exit 1
fi

if [ -n "$RESOLVED_PROVIDER" ]; then
  echo "📡 Provider: $RESOLVED_PROVIDER"
fi

# Ensure keys exist
if [ ! -f "$KEY_DIR/sign_public.pem" ]; then
  echo "⚠️ Generating keypairs in $KEY_DIR..."
  node "$CRYPTO" keygen "$KEY_DIR"
fi

SIGN_PUB=$(cat "$KEY_DIR/sign_public.pem")
ENC_PUB=$(cat "$KEY_DIR/encrypt_public.pem")

# Submit request (questionPreview = plaintext for notifications, question = encrypted)
RESPONSE=$(curl -s -X POST "${BASE_URL}/api/v1/help" \
  -H "Content-Type: application/json" \
  -d "$(node -e "
    const q = process.argv[4];
    console.log(JSON.stringify({
      apiKey: process.argv[1],
      signPublicKey: process.argv[2],
      encryptPublicKey: process.argv[3],
      question: q,
      messages: JSON.parse(process.argv[5])
    }));
  " "$API_KEY" "$SIGN_PUB" "$ENC_PUB" "$QUESTION" "$MESSAGES")")

REQUEST_ID=$(echo "$RESPONSE" | jq -r '.requestId // empty')
REF_CODE=$(echo "$RESPONSE" | jq -r '.refCode // empty')
PROVIDER_UNAVAILABLE=$(echo "$RESPONSE" | jq -r '.providerUnavailable // false')
NEXT_AVAILABLE_AT=$(echo "$RESPONSE" | jq -r '.nextAvailableAt // empty')

if [ -z "$REQUEST_ID" ]; then
  echo "❌ Request failed:" >&2
  echo "$RESPONSE" >&2
  exit 1
fi

# Register request for polling watcher (store refCode + provider name)
mkdir -p "$REQUESTS_DIR"
echo "$REF_CODE" > "$REQUESTS_DIR/$REQUEST_ID"
# Store provider info alongside request
if [ -n "$RESOLVED_PROVIDER" ]; then
  echo "$RESOLVED_PROVIDER" > "$REQUESTS_DIR/${REQUEST_ID}.provider"
fi

echo "✅ Your question has been sent to the provider."
echo "🔖 Ref: $REF_CODE"

# Availability notice
if [ "$PROVIDER_UNAVAILABLE" = "true" ]; then
  if [ -n "$NEXT_AVAILABLE_AT" ]; then
    # Format the ISO timestamp into a human-readable local time
    HUMAN_TIME=$(node -e "
      try {
        const d = new Date(process.argv[1]);
        const now = new Date();
        const diffMs = d - now;
        const diffH = Math.floor(diffMs / 3600000);
        const diffM = Math.round((diffMs % 3600000) / 60000);
        const timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const dateStr = d.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' });
        const today = new Date(); today.setHours(0,0,0,0);
        const tomorrow = new Date(today); tomorrow.setDate(today.getDate()+1);
        const dDay = new Date(d); dDay.setHours(0,0,0,0);
        let when = '';
        if (dDay.getTime() === today.getTime()) when = 'today at ' + timeStr;
        else if (dDay.getTime() === tomorrow.getTime()) when = 'tomorrow at ' + timeStr;
        else when = 'on ' + dateStr + ' at ' + timeStr;
        if (diffH > 0) when += ' (in ' + diffH + 'h ' + diffM + 'm)';
        else if (diffM > 0) when += ' (in ' + diffM + 'm)';
        console.log(when);
      } catch(e) { console.log(process.argv[1]); }
    " "$NEXT_AVAILABLE_AT" 2>/dev/null)
    echo "⚠️  The provider is not available right now."
    echo "🕐 They will be available ${HUMAN_TIME}."
    echo "📬 Your request is queued and will be delivered when they come online."
  else
    echo "⚠️  The provider is not available right now (no schedule configured)."
    echo "📬 Your request is queued and will be delivered when they become available."
  fi
else
  echo "⏳ Waiting for provider response..."
fi

# Sync provider name from platform (update providers.json if name changed)
if [ -f "$PROVIDERS_FILE" ] && [ -n "$API_KEY" ]; then
  WHOAMI=$(curl -s "${BASE_URL}/api/v1/whoami" -H "x-api-key: ${API_KEY}" 2>/dev/null)
  if [ -n "$WHOAMI" ]; then
    node -e "
      const fs = require('fs');
      try {
        const whoami = JSON.parse(process.argv[1]);
        const file = process.argv[2];
        const key = process.argv[3];
        const data = JSON.parse(fs.readFileSync(file, 'utf8'));
        const pName = whoami.provider?.name || whoami.expert?.name || '';
        if (!pName) process.exit(0);
        const entry = data.providers.find(p => p.apiKey === key);
        if (entry && entry.providerName !== pName) {
          entry.providerName = pName;
          fs.writeFileSync(file, JSON.stringify(data, null, 2));
          console.log('🔄 Provider name updated: ' + pName);
        }
      } catch(e) {}
    " "$WHOAMI" "$PROVIDERS_FILE" "$API_KEY" 2>/dev/null
  fi
fi

# Auto-start consumer watcher if not already running
if command -v pm2 &>/dev/null; then
  PM2_STATUS=$(pm2 show heysummon-watcher 2>/dev/null | grep "status" | head -1 | awk '{print $4}')
  if [ "$PM2_STATUS" != "online" ]; then
    echo "🚀 Starting consumer watcher..."
    bash "$SCRIPT_DIR/setup.sh"
  else
    echo "📡 Consumer watcher already running"
    # Signal watcher to refresh topics (picks up the new request)
    WATCHER_PID=$(cat "$REQUESTS_DIR/.watcher.pid" 2>/dev/null)
    if [ -n "$WATCHER_PID" ] && kill -0 "$WATCHER_PID" 2>/dev/null; then
      kill -USR1 "$WATCHER_PID" 2>/dev/null
      echo "🔄 Signaled watcher to refresh topics"
    fi
  fi
else
  echo "📡 Start the watcher manually: bash $SCRIPT_DIR/setup.sh"
fi
