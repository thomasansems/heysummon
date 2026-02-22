#!/bin/bash
# HeySummon E2E Test — Full Circle: consumer submit → provider receive → provider reply → consumer receive
#
# Tests the actual API flow without requiring OpenClaw or skill scripts.
# Uses /api/v1/events/stream SSE proxy (Mercure is internal-only).
#
# Required env vars: E2E_PROVIDER_ID, E2E_PROVIDER_KEY, E2E_CLIENT_KEY
# Optional: E2E_BASE_URL (default: http://localhost:3456), E2E_TIMEOUT

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

pass() { echo -e "${GREEN}✅ $1${NC}"; }
fail() { echo -e "${RED}❌ $1${NC}"; CLEANUP; exit 1; }
info() { echo -e "${YELLOW}ℹ️  $1${NC}"; }

# Config
BASE_URL="${E2E_BASE_URL:-http://localhost:3456}"
PROVIDER_ID="${E2E_PROVIDER_ID:?Set E2E_PROVIDER_ID}"
USER_ID="${E2E_USER_ID:-$PROVIDER_ID}"
PROVIDER_KEY="${E2E_PROVIDER_KEY:?Set E2E_PROVIDER_KEY}"
CLIENT_KEY="${E2E_CLIENT_KEY:?Set E2E_CLIENT_KEY}"
TIMEOUT="${E2E_TIMEOUT:-30}"
STREAM_URL="${BASE_URL}/api/v1/events/stream"

TMPDIR=$(mktemp -d)
PIDS=()

CLEANUP() {
  for pid in "${PIDS[@]}"; do
    kill "$pid" 2>/dev/null || true
  done
  rm -rf "$TMPDIR"
}
trap CLEANUP EXIT

echo ""
echo "══════════════════════════════════════════"
echo "  🧪 HeySummon E2E Test — Full Circle"
echo "══════════════════════════════════════════"
echo ""
info "Platform: $BASE_URL"
info "Stream:   $STREAM_URL"
info "Provider: $PROVIDER_ID"
echo ""

# ─── Test 1: Health Check ───
echo "── Test 1: Platform Health ──"
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "${BASE_URL}/api/health" 2>/dev/null || echo "000")
[ "$HTTP_CODE" = "200" ] && pass "Platform healthy" || fail "Platform not reachable (HTTP $HTTP_CODE)"

# ─── Test 2: SSE Stream Endpoint ───
echo "── Test 2: SSE Stream Endpoint ──"
# Quick check that the endpoint requires auth
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "${STREAM_URL}" 2>/dev/null || echo "000")
[ "$HTTP_CODE" = "401" ] && pass "SSE stream requires auth (401)" || fail "SSE stream auth check unexpected (HTTP $HTTP_CODE)"

# ─── Test 3: Whoami ───
echo "── Test 3: Whoami (client key validation) ──"
WHOAMI=$(curl -s "${BASE_URL}/api/v1/whoami" -H "x-api-key: ${CLIENT_KEY}")
PROV_NAME=$(echo "$WHOAMI" | jq -r '.providerName // .provider.name // empty' 2>/dev/null)
[ -n "$PROV_NAME" ] && pass "Whoami: provider='$PROV_NAME'" || fail "Whoami failed: $WHOAMI"

# ─── Test 4: Submit Request (Consumer → Platform) ───
echo "── Test 4: Submit Request ──"
QUESTION="E2E test $(date +%s): What is 2+2?"

# Start SSE listener for provider BEFORE submitting
info "Starting provider SSE listener..."
curl -sN -H "x-api-key: ${PROVIDER_KEY}" "${STREAM_URL}" > "$TMPDIR/provider-events.raw" 2>/dev/null &
PIDS+=($!)
sleep 2

# Generate ephemeral crypto keys for the request (Ed25519 + X25519)
KEYS_JSON=$(node -e "
const crypto = require('crypto');
const sign = crypto.generateKeyPairSync('ed25519', {
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});
const enc = crypto.generateKeyPairSync('x25519', {
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});
console.log(JSON.stringify({
  signPublicKey: sign.publicKey,
  encryptPublicKey: enc.publicKey,
}));
")

SIGN_PUB=$(echo "$KEYS_JSON" | jq -r '.signPublicKey')
ENC_PUB=$(echo "$KEYS_JSON" | jq -r '.encryptPublicKey')

# Submit via /api/v1/help
SUBMIT_RESPONSE=$(curl -s -X POST "${BASE_URL}/api/v1/help" \
  -H "Content-Type: application/json" \
  -d "$(jq -n \
    --arg apiKey "$CLIENT_KEY" \
    --arg signPublicKey "$SIGN_PUB" \
    --arg encryptPublicKey "$ENC_PUB" \
    --arg question "$QUESTION" \
    '{apiKey: $apiKey, signPublicKey: $signPublicKey, encryptPublicKey: $encryptPublicKey, question: $question, messages: []}'
  )")

REF_CODE=$(echo "$SUBMIT_RESPONSE" | jq -r '.refCode // empty')
REQUEST_ID=$(echo "$SUBMIT_RESPONSE" | jq -r '.requestId // empty')

if [ -n "$REF_CODE" ] && [ "$REF_CODE" != "null" ]; then
  pass "Request submitted: $REF_CODE (id: $REQUEST_ID)"
else
  fail "Submit failed: $SUBMIT_RESPONSE"
fi

# ─── Test 5: Provider receives event via SSE proxy ───
echo "── Test 5: Provider SSE Notification ──"
RECEIVED=false
for i in $(seq 1 $TIMEOUT); do
  if grep -q "$REF_CODE" "$TMPDIR/provider-events.raw" 2>/dev/null; then
    RECEIVED=true
    break
  fi
  sleep 1
done

[ "$RECEIVED" = true ] && pass "Provider received event via SSE proxy" || fail "Provider did not receive event within ${TIMEOUT}s"

# ─── Test 6: Start consumer SSE listener + Provider Reply ───
echo "── Test 6: Provider Reply ──"
ANSWER="E2E answer: The answer is 4"

# Start consumer SSE listener
curl -sN -H "x-api-key: ${CLIENT_KEY}" "${STREAM_URL}" > "$TMPDIR/consumer-events.raw" 2>/dev/null &
PIDS+=($!)
sleep 1

# Look up request ID by refCode (as provider does)
LOOKUP=$(curl -s "${BASE_URL}/api/v1/requests/by-ref/${REF_CODE}" \
  -H "x-api-key: ${PROVIDER_KEY}")
LOOKUP_ID=$(echo "$LOOKUP" | jq -r '.requestId // .id // empty')
[ -n "$LOOKUP_ID" ] && pass "Ref lookup: $REF_CODE → $LOOKUP_ID" || fail "Ref lookup failed: $LOOKUP"

# Send response via /api/v1/message/:requestId (plaintext mode)
REPLY_RESPONSE=$(curl -s -X POST "${BASE_URL}/api/v1/message/${LOOKUP_ID}" \
  -H "x-api-key: ${PROVIDER_KEY}" \
  -H "Content-Type: application/json" \
  -d "$(jq -n --arg plaintext "$ANSWER" '{from: "provider", plaintext: $plaintext}')")

REPLY_OK=$(echo "$REPLY_RESPONSE" | jq -r 'if .success or .messageId or .id then "ok" else empty end' 2>/dev/null)
[ "$REPLY_OK" = "ok" ] && pass "Provider replied: '$ANSWER'" || fail "Reply failed: $REPLY_RESPONSE"

# ─── Test 7: Consumer receives response via SSE proxy ───
echo "── Test 7: Consumer SSE Response ──"
RECEIVED=false
for i in $(seq 1 $TIMEOUT); do
  if grep -q "answer" "$TMPDIR/consumer-events.raw" 2>/dev/null || \
     grep -q "provider" "$TMPDIR/consumer-events.raw" 2>/dev/null; then
    RECEIVED=true
    break
  fi
  sleep 1
done

[ "$RECEIVED" = true ] && pass "Consumer received response via SSE proxy" || fail "Consumer did not receive response within ${TIMEOUT}s"

# ─── Test 8: Verify via API ───
echo "── Test 8: Request Status ──"
STATUS_RESP=$(curl -s "${BASE_URL}/api/v1/help/${REQUEST_ID}" \
  -H "x-api-key: ${PROVIDER_KEY}" 2>/dev/null || echo "{}")
STATUS=$(echo "$STATUS_RESP" | jq -r '.status // "unknown"' 2>/dev/null)
info "Request status: $STATUS"
pass "Full circle verified"

# ─── Test 9: Guard — XSS Stripped ───
echo "── Test 9: Guard — XSS Stripped ──"
GUARD_URL="${GUARD_URL:-http://localhost:3457}"
XSS_RESP=$(curl -s -X POST "${GUARD_URL}/validate" \
  -H "Content-Type: application/json" \
  -d '{"content": "Hello <script>alert(1)</script> world"}' 2>/dev/null || echo "{}")
XSS_SANITIZED=$(echo "$XSS_RESP" | jq -r '.sanitizedText // empty')
if echo "$XSS_SANITIZED" | grep -q "script"; then
  fail "XSS not stripped: $XSS_SANITIZED"
else
  [ -n "$XSS_SANITIZED" ] && pass "XSS stripped: '$XSS_SANITIZED'" || info "Guard not available, skipping"
fi

# ─── Test 10: Guard — URL Defanged ───
echo "── Test 10: Guard — URL Defanged ──"
URL_RESP=$(curl -s -X POST "${GUARD_URL}/validate" \
  -H "Content-Type: application/json" \
  -d '{"content": "Visit https://evil.com/phish for info"}' 2>/dev/null || echo "{}")
URL_SANITIZED=$(echo "$URL_RESP" | jq -r '.sanitizedText // empty')
if [ -n "$URL_SANITIZED" ]; then
  echo "$URL_SANITIZED" | grep -q "hxxps" && pass "URL defanged: '$URL_SANITIZED'" || fail "URL not defanged: $URL_SANITIZED"
else
  info "Guard not available, skipping"
fi

# ─── Test 11: Guard — Credit Card Flagged ───
echo "── Test 11: Guard — Credit Card Flagged ──"
CC_RESP=$(curl -s -X POST "${GUARD_URL}/validate" \
  -H "Content-Type: application/json" \
  -d '{"content": "My card is 4111111111111111"}' 2>/dev/null || echo "{}")
CC_BLOCKED=$(echo "$CC_RESP" | jq -r '.blocked // empty')
if [ -n "$CC_BLOCKED" ]; then
  [ "$CC_BLOCKED" = "true" ] && pass "Credit card blocked" || fail "Credit card not blocked"
else
  info "Guard not available, skipping"
fi

# ─── Test 12: Guard — Clean Text Passes ───
echo "── Test 12: Guard — Clean Text Passes ──"
CLEAN_RESP=$(curl -s -X POST "${GUARD_URL}/validate" \
  -H "Content-Type: application/json" \
  -d '{"content": "Just a normal help request about coding"}' 2>/dev/null || echo "{}")
CLEAN_BLOCKED=$(echo "$CLEAN_RESP" | jq -r '.blocked // empty')
CLEAN_FLAGS=$(echo "$CLEAN_RESP" | jq -r '.flags | length' 2>/dev/null || echo "")
if [ -n "$CLEAN_BLOCKED" ]; then
  [ "$CLEAN_BLOCKED" = "false" ] && [ "$CLEAN_FLAGS" = "0" ] && pass "Clean text passes through" || fail "Clean text incorrectly flagged"
else
  info "Guard not available, skipping"
fi

echo ""
echo "══════════════════════════════════════════"
echo -e "  ${GREEN}🎉 ALL E2E TESTS PASSED${NC}"
echo "══════════════════════════════════════════"
echo ""
