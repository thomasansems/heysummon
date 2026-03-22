#!/bin/bash
# HeySummon Claude Code Skill — Ask a human (blocking poll)
#
# Usage:
#   ask.sh "<question>"
#   ask.sh "<question>" "<context>" "<provider-name>"
#
# Returns the human's response on stdout.
# Exits 0 on success, 1 on timeout or error.

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SKILL_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

# Load .env
[ -f "$SKILL_DIR/.env" ] && set -a && source "$SKILL_DIR/.env" && set +a

BASE_URL="${HEYSUMMON_BASE_URL:-http://localhost:3425}"
API_KEY="${HEYSUMMON_API_KEY:-}"
TIMEOUT="${HEYSUMMON_TIMEOUT:-900}"
POLL_INTERVAL="${HEYSUMMON_POLL_INTERVAL:-3}"

QUESTION="$1"
CONTEXT="${2:-}"
PROVIDER_NAME="${3:-}"

if [ -z "$QUESTION" ]; then
  echo "Usage: ask.sh \"<question>\" [context] [provider-name]" >&2
  exit 1
fi

if [ -z "$API_KEY" ]; then
  echo "HEYSUMMON_API_KEY not set. Run: bash $SCRIPT_DIR/setup.sh" >&2
  exit 1
fi

# Submit help request with generated crypto keys
echo "HeySummon: Submitting request to human..." >&2

RESPONSE=$(node -e "
const crypto = require('crypto');
const https = require('https');
const http = require('http');

// Generate Ed25519 (signing) + X25519 (encryption) key pairs
const signKeys = crypto.generateKeyPairSync('ed25519');
const encKeys = crypto.generateKeyPairSync('x25519');
const signPub = signKeys.publicKey.export({ type: 'spki', format: 'der' }).toString('hex');
const encPub = encKeys.publicKey.export({ type: 'spki', format: 'der' }).toString('hex');

const question = process.argv[1];
const context = process.argv[2];
const providerName = process.argv[3] || undefined;
const apiKey = process.argv[4];

let messages = [];
if (context) {
  try { messages = JSON.parse(context); } catch { messages = []; }
}

const body = {
  apiKey,
  question,
  signPublicKey: signPub,
  encryptPublicKey: encPub,
};
if (messages.length > 0) body.messages = messages;
if (providerName) body.providerName = providerName;

const data = JSON.stringify(body);
const url = new URL(process.argv[5] + '/api/v1/help');
const mod = url.protocol === 'https:' ? https : http;

const req = mod.request(url, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(data),
  },
}, (res) => {
  let chunks = '';
  res.on('data', c => chunks += c);
  res.on('end', () => {
    process.stdout.write(chunks);
  });
});
req.on('error', (e) => {
  process.stderr.write('Request failed: ' + e.message + '\n');
  process.exit(1);
});
req.write(data);
req.end();
" "$QUESTION" "$CONTEXT" "$PROVIDER_NAME" "$API_KEY" "$BASE_URL" 2>/dev/null)

# Check for errors
ERROR=$(echo "$RESPONSE" | node -e "
let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{
  try { const j=JSON.parse(d); if(j.error) process.stdout.write(j.error); } catch {}
})" 2>/dev/null)

if [ -n "$ERROR" ]; then
  echo "Failed: $ERROR" >&2
  exit 1
fi

# Check for unavailable provider
UNAVAILABLE=$(echo "$RESPONSE" | node -e "
let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{
  try {
    const j=JSON.parse(d);
    if(j.providerUnavailable){
      const next = j.nextAvailableAt ? ' (available at '+new Date(j.nextAvailableAt).toLocaleTimeString()+')' : '';
      process.stdout.write('UNAVAILABLE'+next);
    }
  } catch {}
})" 2>/dev/null)

if [ -n "$UNAVAILABLE" ]; then
  echo "Provider unavailable $UNAVAILABLE" >&2
  echo "PROVIDER_UNAVAILABLE: No human available right now. Try again later."
  exit 0
fi

# Extract request ID and ref code
REQUEST_ID=$(echo "$RESPONSE" | node -e "
let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{
  try { const j=JSON.parse(d); process.stdout.write(j.requestId||j.id||''); } catch {}
})" 2>/dev/null)

REF_CODE=$(echo "$RESPONSE" | node -e "
let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{
  try { const j=JSON.parse(d); process.stdout.write(j.refCode||''); } catch {}
})" 2>/dev/null)

if [ -z "$REQUEST_ID" ]; then
  echo "Failed to submit request: $RESPONSE" >&2
  exit 1
fi

echo "Request submitted [${REF_CODE:-$REQUEST_ID}] — waiting for human response..." >&2
echo "   (timeout: ${TIMEOUT}s, polling every ${POLL_INTERVAL}s)" >&2

# Poll for response
ELAPSED=0
while [ "$ELAPSED" -lt "$TIMEOUT" ]; do
  sleep "$POLL_INTERVAL"
  ELAPSED=$((ELAPSED + POLL_INTERVAL))

  # Poll request status directly
  STATUS_RESP=$(curl -s \
    -H "X-API-Key: $API_KEY" \
    "$BASE_URL/api/v1/help/$REQUEST_ID" 2>/dev/null)

  ANSWER=$(echo "$STATUS_RESP" | node -e "
let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{
  try {
    const j = JSON.parse(d);
    if (j.status === 'cancelled') {
      process.stdout.write('CANCELLED');
      process.exit(0);
    }
    if (j.status === 'responded' || j.status === 'closed') {
      // Direct response field (set by Telegram webhook)
      if (j.response) {
        process.stdout.write(j.response);
        process.exit(0);
      }
    }
  } catch {}
  process.exit(1);
})" 2>/dev/null)

  if [ $? -eq 0 ] && [ -n "$ANSWER" ]; then
    echo "" >&2
    if [ "$ANSWER" = "CANCELLED" ]; then
      echo "Request cancelled [${REF_CODE:-$REQUEST_ID}]" >&2
      echo "CANCELLED: The request was cancelled by the provider."
      exit 2
    fi
    echo "Human responded [${REF_CODE:-$REQUEST_ID}]" >&2
    echo "$ANSWER"
    exit 0
  fi

  # Fallback: check messages endpoint for plaintext replies
  MSG_ANSWER=$(curl -s \
    -H "X-API-Key: $API_KEY" \
    "$BASE_URL/api/v1/messages/$REQUEST_ID" 2>/dev/null | node -e "
let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{
  try {
    const j = JSON.parse(d);
    const msgs = j.messages || [];
    const providerMsg = msgs.filter(m => m.from === 'provider').pop();
    if (providerMsg) {
      // Plaintext messages (e.g. Telegram replies) have a plaintext field
      if (providerMsg.plaintext) {
        process.stdout.write(providerMsg.plaintext);
        process.exit(0);
      }
      // Fallback: raw ciphertext (encrypted, can't decode without keys)
      if (providerMsg.ciphertext) {
        process.stdout.write('(encrypted response received)');
        process.exit(0);
      }
    }
  } catch {}
  process.exit(1);
})" 2>/dev/null)

  if [ $? -eq 0 ] && [ -n "$MSG_ANSWER" ]; then
    echo "" >&2
    echo "Human responded [${REF_CODE:-$REQUEST_ID}]" >&2
    echo "$MSG_ANSWER"

    # ACK the event
    curl -s -X POST "$BASE_URL/api/v1/events/ack/$REQUEST_ID" \
      -H "x-api-key: $API_KEY" >/dev/null 2>&1

    exit 0
  fi

  # Progress indicator
  if [ $((ELAPSED % 30)) -eq 0 ]; then
    echo "   Still waiting... (${ELAPSED}s elapsed)" >&2
  fi
done

echo "" >&2
echo "Timeout after ${TIMEOUT}s — no response received." >&2
echo "   Request ref: ${REF_CODE:-$REQUEST_ID}" >&2
echo "TIMEOUT: No response received after ${TIMEOUT}s for request ${REF_CODE:-$REQUEST_ID}. The provider may still respond later."
exit 0
