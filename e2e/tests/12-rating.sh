#!/bin/bash
# HeySummon E2E — 12: Rating endpoint validation
# Tests: submit → respond → rate, re-rate (409), rate on pending (400), invalid rating (400)
set -uo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../lib.sh"

echo ""
echo "══════════════════════════════════════════"
echo "  12 — Rating Endpoint"
echo "══════════════════════════════════════════"

# ── Submit and respond to a request ──
section "Setup: submit + respond"

SUBMIT=$(curl -s -X POST "${GUARD_URL}/api/v1/help" \
  "${E2E_BYPASS_ARGS[@]}" \
  -H "Content-Type: application/json" \
  -d "$(jq -n \
    --arg apiKey "$CLIENT_KEY" \
    --arg question "Rating test $(date +%s)" \
    '{apiKey: $apiKey, question: $question, signPublicKey: "rate-test-sign", encryptPublicKey: "rate-test-encrypt"}'
  )")

REQUEST_ID=$(echo "$SUBMIT" | jq -r '.requestId // empty')
if [ -z "$REQUEST_ID" ] || [ "$REQUEST_ID" = "null" ]; then
  fail "Submit failed: $SUBMIT"
  summary
fi
pass "Request submitted: $REQUEST_ID"

curl -s -X POST "${BASE_URL}/api/v1/message/${REQUEST_ID}" \
  "${E2E_BYPASS_ARGS[@]}" \
  -H "Content-Type: application/json" \
  -H "x-api-key: ${PROVIDER_KEY}" \
  -d '{"from": "provider", "plaintext": "Rating test response"}' > /dev/null

pass "Provider responded"

# ── Rate the response (valid: 1-5) ──
section "Rate response (valid)"

RATE=$(curl -s -X POST "${BASE_URL}/api/v1/rate/${REQUEST_ID}" \
  "${E2E_BYPASS_ARGS[@]}" \
  -H "Content-Type: application/json" \
  -H "x-api-key: ${CLIENT_KEY}" \
  -d '{"rating": 4, "feedback": "E2E test feedback"}')

if echo "$RATE" | jq -e '.success == true and .rating == 4' >/dev/null 2>&1; then
  pass "Rated successfully (4/5)"
else
  fail "Rating failed: $RATE"
fi

# ── Re-rate should return 409 ──
section "Re-rate (should be 409)"

RERATE_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST "${BASE_URL}/api/v1/rate/${REQUEST_ID}" \
  "${E2E_BYPASS_ARGS[@]}" \
  -H "Content-Type: application/json" \
  -H "x-api-key: ${CLIENT_KEY}" \
  -d '{"rating": 5}')

if [ "$RERATE_STATUS" = "409" ]; then
  pass "Re-rate correctly returns 409"
else
  fail "Expected 409, got: $RERATE_STATUS"
fi

# ── Rate on pending request should return 400 ──
section "Rate on pending request (should be 400)"

PENDING_SUBMIT=$(curl -s -X POST "${GUARD_URL}/api/v1/help" \
  "${E2E_BYPASS_ARGS[@]}" \
  -H "Content-Type: application/json" \
  -d "$(jq -n \
    --arg apiKey "$CLIENT_KEY" \
    --arg question "Rating pending test $(date +%s)" \
    '{apiKey: $apiKey, question: $question, signPublicKey: "rate-pending-sign", encryptPublicKey: "rate-pending-encrypt"}'
  )")

PENDING_ID=$(echo "$PENDING_SUBMIT" | jq -r '.requestId // empty')

RATE_PENDING_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST "${BASE_URL}/api/v1/rate/${PENDING_ID}" \
  "${E2E_BYPASS_ARGS[@]}" \
  -H "Content-Type: application/json" \
  -H "x-api-key: ${CLIENT_KEY}" \
  -d '{"rating": 3}')

if [ "$RATE_PENDING_STATUS" = "400" ]; then
  pass "Rating pending request correctly returns 400"
else
  fail "Expected 400 for pending request, got: $RATE_PENDING_STATUS"
fi

# ── Invalid rating values should return 400 ──
section "Invalid rating values (should be 400)"

# Submit + respond for this test
INVALID_SUBMIT=$(curl -s -X POST "${GUARD_URL}/api/v1/help" \
  "${E2E_BYPASS_ARGS[@]}" \
  -H "Content-Type: application/json" \
  -d "$(jq -n \
    --arg apiKey "$CLIENT_KEY" \
    --arg question "Invalid rating test $(date +%s)" \
    '{apiKey: $apiKey, question: $question, signPublicKey: "rate-invalid-sign", encryptPublicKey: "rate-invalid-encrypt"}'
  )")
INVALID_ID=$(echo "$INVALID_SUBMIT" | jq -r '.requestId // empty')

curl -s -X POST "${BASE_URL}/api/v1/message/${INVALID_ID}" \
  "${E2E_BYPASS_ARGS[@]}" \
  -H "Content-Type: application/json" \
  -H "x-api-key: ${PROVIDER_KEY}" \
  -d '{"from": "provider", "plaintext": "For invalid rating test"}' > /dev/null

# Rating 0 (below minimum)
RATE_ZERO_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST "${BASE_URL}/api/v1/rate/${INVALID_ID}" \
  "${E2E_BYPASS_ARGS[@]}" \
  -H "Content-Type: application/json" \
  -H "x-api-key: ${CLIENT_KEY}" \
  -d '{"rating": 0}')

if [ "$RATE_ZERO_STATUS" = "400" ]; then
  pass "Rating 0 correctly returns 400"
else
  fail "Expected 400 for rating 0, got: $RATE_ZERO_STATUS"
fi

# Rating 6 (above maximum)
RATE_SIX_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST "${BASE_URL}/api/v1/rate/${INVALID_ID}" \
  "${E2E_BYPASS_ARGS[@]}" \
  -H "Content-Type: application/json" \
  -H "x-api-key: ${CLIENT_KEY}" \
  -d '{"rating": 6}')

if [ "$RATE_SIX_STATUS" = "400" ]; then
  pass "Rating 6 correctly returns 400"
else
  fail "Expected 400 for rating 6, got: $RATE_SIX_STATUS"
fi

summary
