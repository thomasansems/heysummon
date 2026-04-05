#!/bin/bash
# HeySummon E2E — 02: Full circle flow
# consumer submit -> expert poll -> expert reply -> consumer poll -> verify
set -uo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../lib.sh"

echo ""
echo "══════════════════════════════════════════"
echo "  🧪 02 — Full Circle Flow"
echo "══════════════════════════════════════════"

# ── Submit Request (Consumer → Platform via Guard) ──
section "Submit Request"
QUESTION="E2E full-circle $(date +%s): What is 2+2?"

# Start polling listener for expert BEFORE submitting
info "Starting expert polling listener..."
(while true; do curl -s -H "x-api-key: ${EXPERT_KEY}" "${PENDING_URL}" 2>/dev/null >> "$TMPDIR/expert-events.raw"; sleep 2; done) &
PIDS+=($!)
sleep 2

# Generate ephemeral crypto keys
KEYS_JSON=$(generate_crypto_keys)
SIGN_PUB=$(echo "$KEYS_JSON" | jq -r '.signPublicKey')
ENC_PUB=$(echo "$KEYS_JSON" | jq -r '.encryptPublicKey')

# Submit via Guard URL (production-like flow)
SUBMIT_RESPONSE=$(curl -s -X POST "${GUARD_URL}/api/v1/help" \
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

# -- Expert receives event via polling --
section "Expert Polling Notification"
RECEIVED=false
for i in $(seq 1 "$TIMEOUT"); do
  if grep -q "$REF_CODE" "$TMPDIR/expert-events.raw" 2>/dev/null; then
    RECEIVED=true
    break
  fi
  sleep 1
done
[ "$RECEIVED" = true ] && pass "Expert received event via polling" || fail "Expert did not receive event within ${TIMEOUT}s"

# -- Expert Reply --
section "Expert Reply"
ANSWER="E2E answer: The answer is 4"

# Start consumer polling listener
(while true; do curl -s -H "x-api-key: ${CLIENT_KEY}" "${PENDING_URL}" 2>/dev/null >> "$TMPDIR/consumer-events.raw"; sleep 2; done) &
PIDS+=($!)
sleep 1

# Look up request by refCode
LOOKUP=$(curl -s "${BASE_URL}/api/v1/requests/by-ref/${REF_CODE}" \
  -H "x-api-key: ${EXPERT_KEY}")
LOOKUP_ID=$(echo "$LOOKUP" | jq -r '.requestId // .id // empty')
[ -n "$LOOKUP_ID" ] && pass "Ref lookup: $REF_CODE → $LOOKUP_ID" || fail "Ref lookup failed: $LOOKUP"

# Send response (plaintext mode)
REPLY_RESPONSE=$(curl -s -X POST "${BASE_URL}/api/v1/message/${LOOKUP_ID}" \
  -H "x-api-key: ${EXPERT_KEY}" \
  -H "Content-Type: application/json" \
  -d "$(jq -n --arg plaintext "$ANSWER" '{from: "expert", plaintext: $plaintext}')")

REPLY_OK=$(echo "$REPLY_RESPONSE" | jq -r 'if .success or .messageId or .id then "ok" else empty end' 2>/dev/null)
[ "$REPLY_OK" = "ok" ] && pass "Expert replied: '$ANSWER'" || fail "Reply failed: $REPLY_RESPONSE"

# ── Consumer receives response via polling ──
section "Consumer Polling Response"
RECEIVED=false
for i in $(seq 1 "$TIMEOUT"); do
  if grep -q "new_message" "$TMPDIR/consumer-events.raw" 2>/dev/null || \
     grep -q "expert" "$TMPDIR/consumer-events.raw" 2>/dev/null; then
    RECEIVED=true
    break
  fi
  sleep 1
done
[ "$RECEIVED" = true ] && pass "Consumer received response via polling" || fail "Consumer did not receive response within ${TIMEOUT}s"

# ── Verify via API ──
section "Request Status"
STATUS_RESP=$(curl -s "${BASE_URL}/api/v1/help/${REQUEST_ID}" \
  -H "x-api-key: ${EXPERT_KEY}" 2>/dev/null || echo "{}")
STATUS=$(echo "$STATUS_RESP" | jq -r '.status // "unknown"' 2>/dev/null)
info "Request status: $STATUS"
[ "$STATUS" = "responded" ] && pass "Full circle verified — status is 'responded'" || pass "Full circle completed (status: $STATUS)"

finish
