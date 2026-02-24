#!/bin/bash
# HeySummon E2E — 08: Misconfiguration tests
# Missing fields, invalid keys, wrong provider ID
set -uo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../lib.sh"

echo ""
echo "══════════════════════════════════════════"
echo "  🧪 08 — Misconfiguration"
echo "══════════════════════════════════════════"

# Determine test URL
TEST_URL="$GUARD_URL"
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "${GUARD_URL}/health" 2>/dev/null || echo "000")
if [ "$HTTP_CODE" != "200" ]; then
  TEST_URL="$BASE_URL"
fi

# ── Test: Missing apiKey ──
section "Missing apiKey"
KEYS_JSON=$(generate_crypto_keys)
SIGN_PUB=$(echo "$KEYS_JSON" | jq -r '.signPublicKey')
ENC_PUB=$(echo "$KEYS_JSON" | jq -r '.encryptPublicKey')

RESULT=$(curl -s -w '\n%{http_code}' -X POST "${TEST_URL}/api/v1/help" \
  -H "Content-Type: application/json" \
  -d "$(jq -n \
    --arg signPublicKey "$SIGN_PUB" \
    --arg encryptPublicKey "$ENC_PUB" \
    '{signPublicKey: $signPublicKey, encryptPublicKey: $encryptPublicKey, question: "no api key", messages: []}'
  )")
CODE=$(parse_code "$RESULT")

[ "$CODE" = "400" ] && pass "Missing apiKey rejected (400)" || fail "Expected 400 for missing apiKey, got HTTP $CODE"

# ── Test: Missing crypto keys ──
section "Missing Crypto Keys"
RESULT=$(curl -s -w '\n%{http_code}' -X POST "${TEST_URL}/api/v1/help" \
  -H "Content-Type: application/json" \
  -d "$(jq -n \
    --arg apiKey "$CLIENT_KEY" \
    '{apiKey: $apiKey, question: "no crypto keys", messages: []}'
  )")
CODE=$(parse_code "$RESULT")

[ "$CODE" = "400" ] && pass "Missing crypto keys rejected (400)" || fail "Expected 400 for missing crypto keys, got HTTP $CODE"

# ── Test: Invalid/malformed PEM keys ──
section "Invalid PEM Keys"
RESULT=$(curl -s -w '\n%{http_code}' -X POST "${TEST_URL}/api/v1/help" \
  -H "Content-Type: application/json" \
  -d "$(jq -n \
    --arg apiKey "$CLIENT_KEY" \
    '{apiKey: $apiKey, signPublicKey: "not-a-real-pem-key", encryptPublicKey: "also-not-valid", question: "invalid keys", messages: []}'
  )")
CODE=$(parse_code "$RESULT")
BODY=$(parse_body "$RESULT")

# Should either accept (platform stores keys as-is, validation happens at use) or reject
if [ "$CODE" = "200" ] || [ "$CODE" = "400" ]; then
  pass "Invalid PEM keys handled (HTTP $CODE)"
else
  fail "Unexpected response for invalid PEM keys (HTTP $CODE): $BODY"
fi

# ── Test: Wrong provider ID (key belongs to different provider) ──
section "Wrong Provider ID"
if [ -z "$PROVIDER2_KEY" ]; then
  skip "E2E_PROVIDER2_KEY not set — skipping wrong provider test"
else
  # Create a request owned by provider A (via CLIENT_KEY)
  RESULT=$(submit_help "$TEST_URL" "$CLIENT_KEY" "misconfig-wrong-provider $(date +%s)")
  CODE=$(parse_code "$RESULT")
  BODY=$(parse_body "$RESULT")
  REQUEST_ID=$(echo "$BODY" | jq -r '.requestId // empty')
  REF_CODE=$(echo "$BODY" | jq -r '.refCode // empty')

  if [ "$CODE" = "200" ] && [ -n "$REQUEST_ID" ]; then
    # Try to look up refCode with provider B's key — should fail
    LOOKUP_RESULT=$(curl -s -w '\n%{http_code}' "${BASE_URL}/api/v1/requests/by-ref/${REF_CODE}" \
      -H "x-api-key: ${PROVIDER2_KEY}")
    LOOKUP_CODE=$(parse_code "$LOOKUP_RESULT")

    [ "$LOOKUP_CODE" = "404" ] && pass "Wrong provider cannot look up request (404)" || fail "Expected 404, got HTTP $LOOKUP_CODE"
  else
    fail "Could not create request for wrong-provider test (HTTP $CODE)"
  fi
fi

# ── Test: Provider with no valid key ──
section "No Valid Provider Key"
RESULT=$(curl -s -w '\n%{http_code}' "${BASE_URL}/api/v1/requests/by-ref/HS-ZZZZ" \
  -H "x-api-key: hs_prov_completely_fake_key_1234567890")
CODE=$(parse_code "$RESULT")

# Should return 401 (invalid key) or 404 (ref not found) — either is acceptable
if [ "$CODE" = "401" ] || [ "$CODE" = "404" ]; then
  pass "Invalid provider key handled ($CODE)"
else
  fail "Expected 401/404 for invalid provider key, got HTTP $CODE"
fi

# ── Test: Empty request body ──
section "Empty Request Body"
RESULT=$(curl -s -w '\n%{http_code}' -X POST "${TEST_URL}/api/v1/help" \
  -H "Content-Type: application/json" \
  -d '{}')
CODE=$(parse_code "$RESULT")

if [ "$CODE" = "400" ] || [ "$CODE" = "422" ]; then
  pass "Empty request body rejected ($CODE)"
else
  fail "Expected 400/422 for empty body, got HTTP $CODE"
fi

# ── Test: Missing x-api-key on message endpoint ──
section "Missing x-api-key on Message Endpoint"
RESULT=$(curl -s -w '\n%{http_code}' -X POST "${BASE_URL}/api/v1/message/some-request-id" \
  -H "Content-Type: application/json" \
  -d '{"from": "provider", "plaintext": "no auth"}')
CODE=$(parse_code "$RESULT")

[ "$CODE" = "401" ] && pass "Missing x-api-key rejected (401)" || fail "Expected 401 for missing x-api-key, got HTTP $CODE"

finish
