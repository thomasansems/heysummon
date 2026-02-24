#!/bin/bash
# HeySummon E2E — 03: Guard reverse proxy receipt verification
# Tests that the platform enforces Guard receipt validation
set -uo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../lib.sh"

echo ""
echo "══════════════════════════════════════════"
echo "  🧪 03 — Guard Reverse Proxy"
echo "══════════════════════════════════════════"

HELPERS_DIR="$LIB_DIR/helpers"

# Check that GUARD_SIGNING_KEY is available (needed for receipt crafting)
if [ -z "${GUARD_SIGNING_KEY:-}" ]; then
  skip "GUARD_SIGNING_KEY not set — skipping guard proxy tests"
  finish
  exit 0
fi

# ── Test: Direct request without receipt rejected (REQUIRE_GUARD=true) ──
section "Direct Request Without Receipt"
RESULT=$(submit_help "$BASE_URL" "$CLIENT_KEY" "guard-proxy-test-no-receipt")
CODE=$(parse_code "$RESULT")
BODY=$(parse_body "$RESULT")

if [ "$CODE" = "403" ]; then
  ERROR_MSG=$(echo "$BODY" | jq -r '.error // empty')
  if echo "$ERROR_MSG" | grep -qi "guard"; then
    pass "Direct request rejected without guard receipt (403)"
  else
    fail "Got 403 but unexpected error: $ERROR_MSG"
  fi
else
  fail "Expected 403 for direct request, got HTTP $CODE: $BODY"
fi

# ── Test: Valid receipt through Guard passes ──
section "Valid Receipt Through Guard"
RESULT=$(submit_help "$GUARD_URL" "$CLIENT_KEY" "guard-proxy-test-valid")
CODE=$(parse_code "$RESULT")
BODY=$(parse_body "$RESULT")
REF=$(echo "$BODY" | jq -r '.refCode // empty')

if [ "$CODE" = "200" ] && [ -n "$REF" ] && [ "$REF" != "null" ]; then
  pass "Request through Guard accepted: $REF"
else
  fail "Request through Guard failed (HTTP $CODE): $BODY"
fi

# ── Test: Tampered receipt rejected ──
section "Tampered Receipt"
# Create a valid receipt, then tamper with the token
RECEIPT=$(node "$HELPERS_DIR/create-receipt.js" "tampered-test")
TOKEN=$(echo "$RECEIPT" | jq -r '.token')
SIG=$(echo "$RECEIPT" | jq -r '.signature')

# Tamper: modify the token (flip a character in base64)
TAMPERED_TOKEN=$(echo "$TOKEN" | sed 's/./X/3')

KEYS_JSON=$(generate_crypto_keys)
SIGN_PUB=$(echo "$KEYS_JSON" | jq -r '.signPublicKey')
ENC_PUB=$(echo "$KEYS_JSON" | jq -r '.encryptPublicKey')

RESULT=$(curl -s -w '\n%{http_code}' -X POST "${BASE_URL}/api/v1/help" \
  -H "Content-Type: application/json" \
  -H "x-guard-receipt: $TAMPERED_TOKEN" \
  -H "x-guard-receipt-sig: $SIG" \
  -d "$(jq -n \
    --arg apiKey "$CLIENT_KEY" \
    --arg signPublicKey "$SIGN_PUB" \
    --arg encryptPublicKey "$ENC_PUB" \
    '{apiKey: $apiKey, signPublicKey: $signPublicKey, encryptPublicKey: $encryptPublicKey, question: "tampered test", messages: []}'
  )")
CODE=$(parse_code "$RESULT")

[ "$CODE" = "403" ] && pass "Tampered receipt rejected (403)" || fail "Expected 403 for tampered receipt, got HTTP $CODE"

# ── Test: Expired receipt rejected ──
section "Expired Receipt"
# Create receipt with timestamp 10 minutes in the past
RECEIPT=$(node "$HELPERS_DIR/create-receipt.js" "expired-test" "-600000")
TOKEN=$(echo "$RECEIPT" | jq -r '.token')
SIG=$(echo "$RECEIPT" | jq -r '.signature')

KEYS_JSON=$(generate_crypto_keys)
SIGN_PUB=$(echo "$KEYS_JSON" | jq -r '.signPublicKey')
ENC_PUB=$(echo "$KEYS_JSON" | jq -r '.encryptPublicKey')

RESULT=$(curl -s -w '\n%{http_code}' -X POST "${BASE_URL}/api/v1/help" \
  -H "Content-Type: application/json" \
  -H "x-guard-receipt: $TOKEN" \
  -H "x-guard-receipt-sig: $SIG" \
  -d "$(jq -n \
    --arg apiKey "$CLIENT_KEY" \
    --arg signPublicKey "$SIGN_PUB" \
    --arg encryptPublicKey "$ENC_PUB" \
    '{apiKey: $apiKey, signPublicKey: $signPublicKey, encryptPublicKey: $encryptPublicKey, question: "expired test", messages: []}'
  )")
CODE=$(parse_code "$RESULT")

[ "$CODE" = "403" ] && pass "Expired receipt rejected (403)" || fail "Expected 403 for expired receipt, got HTTP $CODE"

# ── Test: Replay attack blocked ──
section "Replay Attack"
# Create a valid receipt and use it twice
RECEIPT=$(node "$HELPERS_DIR/create-receipt.js" "replay-test")
TOKEN=$(echo "$RECEIPT" | jq -r '.token')
SIG=$(echo "$RECEIPT" | jq -r '.signature')

KEYS_JSON=$(generate_crypto_keys)
SIGN_PUB=$(echo "$KEYS_JSON" | jq -r '.signPublicKey')
ENC_PUB=$(echo "$KEYS_JSON" | jq -r '.encryptPublicKey')

REQUEST_BODY=$(jq -n \
  --arg apiKey "$CLIENT_KEY" \
  --arg signPublicKey "$SIGN_PUB" \
  --arg encryptPublicKey "$ENC_PUB" \
  '{apiKey: $apiKey, signPublicKey: $signPublicKey, encryptPublicKey: $encryptPublicKey, question: "replay test", messages: []}')

# First use — should succeed
RESULT1=$(curl -s -w '\n%{http_code}' -X POST "${BASE_URL}/api/v1/help" \
  -H "Content-Type: application/json" \
  -H "x-guard-receipt: $TOKEN" \
  -H "x-guard-receipt-sig: $SIG" \
  -d "$REQUEST_BODY")
CODE1=$(parse_code "$RESULT1")

if [ "$CODE1" = "200" ]; then
  pass "First use of receipt accepted"
else
  fail "First use of receipt should succeed (got HTTP $CODE1)"
fi

# Second use (replay) — generate new keys since those are per-request
KEYS_JSON2=$(generate_crypto_keys)
SIGN_PUB2=$(echo "$KEYS_JSON2" | jq -r '.signPublicKey')
ENC_PUB2=$(echo "$KEYS_JSON2" | jq -r '.encryptPublicKey')

REQUEST_BODY2=$(jq -n \
  --arg apiKey "$CLIENT_KEY" \
  --arg signPublicKey "$SIGN_PUB2" \
  --arg encryptPublicKey "$ENC_PUB2" \
  '{apiKey: $apiKey, signPublicKey: $signPublicKey, encryptPublicKey: $encryptPublicKey, question: "replay test 2", messages: []}')

RESULT2=$(curl -s -w '\n%{http_code}' -X POST "${BASE_URL}/api/v1/help" \
  -H "Content-Type: application/json" \
  -H "x-guard-receipt: $TOKEN" \
  -H "x-guard-receipt-sig: $SIG" \
  -d "$REQUEST_BODY2")
CODE2=$(parse_code "$RESULT2")

[ "$CODE2" = "403" ] && pass "Replay attack blocked (403)" || fail "Expected 403 for replayed receipt, got HTTP $CODE2"

finish
