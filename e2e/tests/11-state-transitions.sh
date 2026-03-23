#!/bin/bash
# HeySummon E2E — 11: State machine transition invariants
# Tests the formalized state machine: valid transitions, idempotent close, concurrent safety
set -uo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../lib.sh"

echo ""
echo "══════════════════════════════════════════"
echo "  11 — State Machine Transitions"
echo "══════════════════════════════════════════"

# ── Submit a request ──
section "Submit request for state transition tests"

KEYS_JSON=$(generate_crypto_keys)
SIGN_PUB=$(echo "$KEYS_JSON" | jq -r '.signPublicKey')
ENC_PUB=$(echo "$KEYS_JSON" | jq -r '.encryptPublicKey')
SUBMIT_RESPONSE=$(curl -s -X POST "${GUARD_URL}/api/v1/help" \
  "${E2E_BYPASS_ARGS[@]}" \
  -H "Content-Type: application/json" \
  -d "$(jq -n \
    --arg apiKey "$CLIENT_KEY" \
    --arg signPublicKey "$SIGN_PUB" \
    --arg encryptPublicKey "$ENC_PUB" \
    --arg question "State transition test $(date +%s)" \
    '{apiKey: $apiKey, question: $question, signPublicKey: $signPublicKey, encryptPublicKey: $encryptPublicKey}'
  )")

REQUEST_ID=$(echo "$SUBMIT_RESPONSE" | jq -r '.requestId // empty')

if [ -n "$REQUEST_ID" ] && [ "$REQUEST_ID" != "null" ]; then
  pass "Request submitted: $REQUEST_ID"
else
  fail "Submit failed: $SUBMIT_RESPONSE"
  summary
fi

# ── Provider responds (transitions pending → responded) ──
section "Provider responds"

RESPOND=$(curl -s -X POST "${BASE_URL}/api/v1/message/${REQUEST_ID}" \
  "${E2E_BYPASS_ARGS[@]}" \
  -H "Content-Type: application/json" \
  -H "x-api-key: ${PROVIDER_KEY}" \
  -d '{"from": "provider", "plaintext": "State transition test response"}')

if echo "$RESPOND" | jq -e '.success == true' >/dev/null 2>&1; then
  pass "Provider responded"
else
  fail "Provider response failed: $RESPOND"
fi

# ── Close the request (transitions responded → closed) ──
section "Close request"

CLOSE=$(curl -s -X POST "${BASE_URL}/api/v1/close/${REQUEST_ID}" \
  "${E2E_BYPASS_ARGS[@]}" \
  -H "Content-Type: application/json" \
  -H "x-api-key: ${CLIENT_KEY}" \
  -d '{}')

if echo "$CLOSE" | jq -e '.status == "closed"' >/dev/null 2>&1; then
  pass "Request closed"
else
  fail "Close failed: $CLOSE"
fi

PREV_STATUS=$(echo "$CLOSE" | jq -r '.previousStatus // empty')
if [ "$PREV_STATUS" = "responded" ]; then
  pass "Previous status was 'responded' (state machine tracked)"
else
  fail "Expected previousStatus=responded, got: $PREV_STATUS"
fi

# ── Idempotent re-close ──
section "Idempotent re-close"

RECLOSE=$(curl -s -X POST "${BASE_URL}/api/v1/close/${REQUEST_ID}" \
  "${E2E_BYPASS_ARGS[@]}" \
  -H "Content-Type: application/json" \
  -H "x-api-key: ${CLIENT_KEY}" \
  -d '{}')

if echo "$RECLOSE" | jq -e '.status == "closed"' >/dev/null 2>&1; then
  pass "Re-close is idempotent"
else
  fail "Re-close failed: $RECLOSE"
fi

summary
