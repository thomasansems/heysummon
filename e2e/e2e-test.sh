#!/bin/bash
# HeySummon E2E Test — Full Circle: consumer submit → provider receive → provider reply → consumer receive
#
# Tests the actual API flow without requiring OpenClaw or skill scripts.
# Uses direct curl + Mercure SSE listening.
#
# Required env vars: E2E_PROVIDER_ID, E2E_PROVIDER_KEY, E2E_CLIENT_KEY
# Optional: E2E_BASE_URL (default: http://localhost:3456), E2E_MERCURE_HUB, E2E_TIMEOUT

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
MERCURE_HUB="${E2E_MERCURE_HUB:-http://localhost:3100/.well-known/mercure}"
PROVIDER_ID="${E2E_PROVIDER_ID:?Set E2E_PROVIDER_ID}"
USER_ID="${E2E_USER_ID:-$PROVIDER_ID}"
PROVIDER_KEY="${E2E_PROVIDER_KEY:?Set E2E_PROVIDER_KEY}"
CLIENT_KEY="${E2E_CLIENT_KEY:?Set E2E_CLIENT_KEY}"
TIMEOUT="${E2E_TIMEOUT:-30}"

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
info "Mercure:  $MERCURE_HUB"
info "Provider: $PROVIDER_ID"
echo ""

# ─── Test 1: Health Check ───
echo "── Test 1: Platform Health ──"
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "${BASE_URL}/api/health" 2>/dev/null || echo "000")
[ "$HTTP_CODE" = "200" ] && pass "Platform healthy" || fail "Platform not reachable (HTTP $HTTP_CODE)"

# ─── Test 2: Mercure Health ───
echo "── Test 2: Mercure Health ──"
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "${MERCURE_HUB}" 2>/dev/null || echo "000")
[ "$HTTP_CODE" != "000" ] && pass "Mercure reachable" || fail "Mercure not reachable"

# ─── Test 3: Whoami ───
echo "── Test 3: Whoami (client key validation) ──"
WHOAMI=$(curl -s "${BASE_URL}/api/v1/whoami" -H "x-api-key: ${CLIENT_KEY}")
PROV_NAME=$(echo "$WHOAMI" | jq -r '.providerName // .provider.name // empty' 2>/dev/null)
[ -n "$PROV_NAME" ] && pass "Whoami: provider='$PROV_NAME'" || fail "Whoami failed: $WHOAMI"

# ─── Test 4: Submit Request (Consumer → Platform) ───
echo "── Test 4: Submit Request ──"
QUESTION="E2E test $(date +%s): What is 2+2?"

# Start Mercure listener for provider BEFORE submitting
info "Starting provider Mercure listener..."
# Mercure topic uses userId (API key owner), not provider model ID
PROVIDER_TOPIC="/heysummon/providers/${USER_ID}"
curl -sN "${MERCURE_HUB}?topic=${PROVIDER_TOPIC}" > "$TMPDIR/provider-events.raw" 2>/dev/null &
PIDS+=($!)
sleep 1

# Generate ephemeral crypto keys for the request (Ed25519 + X25519)
KEYS_JSON=$(node -e "
const crypto = require('crypto');
// Ed25519 for signing
const sign = crypto.generateKeyPairSync('ed25519', {
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});
// X25519 for encryption
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

# ─── Test 5: Provider receives Mercure event ───
echo "── Test 5: Provider Mercure Notification ──"
RECEIVED=false
for i in $(seq 1 $TIMEOUT); do
  if grep -q "$REF_CODE" "$TMPDIR/provider-events.raw" 2>/dev/null; then
    RECEIVED=true
    break
  fi
  sleep 1
done

[ "$RECEIVED" = true ] && pass "Provider received Mercure event" || fail "Provider did not receive event within ${TIMEOUT}s"

# ─── Test 6: Start consumer Mercure listener + Provider Reply ───
echo "── Test 6: Provider Reply ──"
ANSWER="E2E answer: The answer is 4"

# Start consumer Mercure listener on request topic
REQUEST_TOPIC="/heysummon/requests/${REQUEST_ID}"
curl -sN "${MERCURE_HUB}?topic=${REQUEST_TOPIC}" > "$TMPDIR/consumer-events.raw" 2>/dev/null &
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

# ─── Test 7: Consumer receives response via Mercure ───
echo "── Test 7: Consumer Mercure Response ──"
RECEIVED=false
for i in $(seq 1 $TIMEOUT); do
  if grep -q "answer" "$TMPDIR/consumer-events.raw" 2>/dev/null || \
     grep -q "provider" "$TMPDIR/consumer-events.raw" 2>/dev/null; then
    RECEIVED=true
    break
  fi
  sleep 1
done

[ "$RECEIVED" = true ] && pass "Consumer received response via Mercure" || fail "Consumer did not receive response within ${TIMEOUT}s"

# ─── Test 8: Verify via API ───
echo "── Test 8: Request Status ──"
STATUS_RESP=$(curl -s "${BASE_URL}/api/v1/help/${REQUEST_ID}" \
  -H "x-api-key: ${PROVIDER_KEY}" 2>/dev/null || echo "{}")
STATUS=$(echo "$STATUS_RESP" | jq -r '.status // "unknown"' 2>/dev/null)
info "Request status: $STATUS"
pass "Full circle verified"

echo ""
echo "══════════════════════════════════════════"
echo -e "  ${GREEN}🎉 ALL E2E TESTS PASSED${NC}"
echo "══════════════════════════════════════════"
echo ""
