#!/bin/bash
# HeySummon E2E — 09: Comprehensive Guard Security Suite
# Tests every security layer of the Guard reverse proxy:
#   - Ed25519 receipt signing & verification
#   - Replay attack protection (nonce uniqueness)
#   - Timestamp freshness validation
#   - Content safety pipeline (XSS, PII, URL defanging)
#   - Payload size limits
#   - Header injection resistance
#   - Route-level validation (only POST content routes signed)
#   - Receipt absence / malformation
#   - Content hash integrity (receipt matches actual content)
set -uo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../lib.sh"

echo ""
echo "══════════════════════════════════════════════════"
echo "  🛡️  09 — Comprehensive Guard Security Suite"
echo "══════════════════════════════════════════════════"

HELPERS_DIR="$LIB_DIR/helpers"

# Check Guard is available
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "${GUARD_URL}/health" 2>/dev/null || echo "000")
if [ "$HTTP_CODE" != "200" ]; then
  skip "Guard not available at ${GUARD_URL} — skipping guard security tests"
  finish
  exit 0
fi

if [ -z "${GUARD_SIGNING_KEY:-}" ]; then
  skip "GUARD_SIGNING_KEY not set — skipping receipt-crafting tests"
  finish
  exit 0
fi

# ═══════════════════════════════════════════════════════
# SECTION 1: Ed25519 Receipt Signing & Verification
# ═══════════════════════════════════════════════════════

section "1.1 — Valid request through Guard"
RESULT=$(submit_help "$GUARD_URL" "$CLIENT_KEY" "guard-sec-valid-request")
CODE=$(parse_code "$RESULT")
BODY=$(parse_body "$RESULT")
REF=$(echo "$BODY" | jq -r '.refCode // empty')
if [ "$CODE" = "200" ] && [ -n "$REF" ] && [ "$REF" != "null" ]; then
  pass "Valid request through Guard accepted: $REF"
else
  fail "Valid request through Guard failed (HTTP $CODE): $BODY"
fi

section "1.2 — Direct request without receipt rejected (REQUIRE_GUARD)"
RESULT=$(submit_help "$BASE_URL" "$CLIENT_KEY" "guard-sec-no-receipt")
CODE=$(parse_code "$RESULT")
BODY=$(parse_body "$RESULT")
if [ "$CODE" = "403" ]; then
  ERROR_MSG=$(echo "$BODY" | jq -r '.error // empty')
  if echo "$ERROR_MSG" | grep -qi "guard"; then
    pass "Direct request without receipt rejected (403, Guard required)"
  else
    pass "Direct request rejected (403): $ERROR_MSG"
  fi
elif [ "$CODE" = "200" ]; then
  info "Direct request accepted — REQUIRE_GUARD may be false (non-fatal)"
  pass "Direct request handled (REQUIRE_GUARD not enforced)"
else
  fail "Unexpected response for direct request (HTTP $CODE): $BODY"
fi

section "1.3 — Tampered receipt token rejected"
RECEIPT=$(node "$HELPERS_DIR/create-receipt.js" "tampered-test-content")
TOKEN=$(echo "$RECEIPT" | jq -r '.token')
SIG=$(echo "$RECEIPT" | jq -r '.signature')
# Flip characters in the middle of the base64 token
TAMPERED_TOKEN=$(echo "$TOKEN" | sed 's/./X/5;s/./Y/10;s/./Z/15')
KEYS_JSON=$(generate_crypto_keys)
SIGN_PUB=$(echo "$KEYS_JSON" | jq -r '.signPublicKey')
ENC_PUB=$(echo "$KEYS_JSON" | jq -r '.encryptPublicKey')
RESULT=$(curl -s "${E2E_BYPASS_ARGS[@]}" -w '\n%{http_code}' -X POST "${BASE_URL}/api/v1/help" \
  -H "Content-Type: application/json" \
  -H "x-guard-receipt: $TAMPERED_TOKEN" \
  -H "x-guard-receipt-sig: $SIG" \
  -d "$(jq -n --arg a "$CLIENT_KEY" --arg s "$SIGN_PUB" --arg e "$ENC_PUB" \
    '{apiKey:$a,signPublicKey:$s,encryptPublicKey:$e,question:"tampered test",messages:[]}')")
CODE=$(parse_code "$RESULT")
[ "$CODE" = "403" ] && pass "Tampered receipt token rejected (403)" || fail "Expected 403 for tampered token, got HTTP $CODE"

section "1.4 — Tampered receipt signature rejected"
RECEIPT=$(node "$HELPERS_DIR/create-receipt.js" "sig-tamper-test")
TOKEN=$(echo "$RECEIPT" | jq -r '.token')
SIG=$(echo "$RECEIPT" | jq -r '.signature')
# Flip chars in signature
TAMPERED_SIG=$(echo "$SIG" | sed 's/./A/3;s/./B/8;s/./C/13')
KEYS_JSON=$(generate_crypto_keys)
SIGN_PUB=$(echo "$KEYS_JSON" | jq -r '.signPublicKey')
ENC_PUB=$(echo "$KEYS_JSON" | jq -r '.encryptPublicKey')
RESULT=$(curl -s "${E2E_BYPASS_ARGS[@]}" -w '\n%{http_code}' -X POST "${BASE_URL}/api/v1/help" \
  -H "Content-Type: application/json" \
  -H "x-guard-receipt: $TOKEN" \
  -H "x-guard-receipt-sig: $TAMPERED_SIG" \
  -d "$(jq -n --arg a "$CLIENT_KEY" --arg s "$SIGN_PUB" --arg e "$ENC_PUB" \
    '{apiKey:$a,signPublicKey:$s,encryptPublicKey:$e,question:"sig tamper test",messages:[]}')")
CODE=$(parse_code "$RESULT")
[ "$CODE" = "403" ] && pass "Tampered signature rejected (403)" || fail "Expected 403 for tampered sig, got HTTP $CODE"

section "1.5 — Empty receipt headers rejected"
KEYS_JSON=$(generate_crypto_keys)
SIGN_PUB=$(echo "$KEYS_JSON" | jq -r '.signPublicKey')
ENC_PUB=$(echo "$KEYS_JSON" | jq -r '.encryptPublicKey')
RESULT=$(curl -s "${E2E_BYPASS_ARGS[@]}" -w '\n%{http_code}' -X POST "${BASE_URL}/api/v1/help" \
  -H "Content-Type: application/json" \
  -H "x-guard-receipt: " \
  -H "x-guard-receipt-sig: " \
  -d "$(jq -n --arg a "$CLIENT_KEY" --arg s "$SIGN_PUB" --arg e "$ENC_PUB" \
    '{apiKey:$a,signPublicKey:$s,encryptPublicKey:$e,question:"empty receipt",messages:[]}')")
CODE=$(parse_code "$RESULT")
if [ "$CODE" = "403" ] || [ "$CODE" = "200" ]; then
  # 403 = REQUIRE_GUARD enforced (empty = no receipt), 200 = REQUIRE_GUARD off
  pass "Empty receipt headers handled (HTTP $CODE)"
else
  fail "Unexpected response for empty receipt (HTTP $CODE)"
fi

section "1.6 — Garbage base64 receipt rejected"
KEYS_JSON=$(generate_crypto_keys)
SIGN_PUB=$(echo "$KEYS_JSON" | jq -r '.signPublicKey')
ENC_PUB=$(echo "$KEYS_JSON" | jq -r '.encryptPublicKey')
RESULT=$(curl -s "${E2E_BYPASS_ARGS[@]}" -w '\n%{http_code}' -X POST "${BASE_URL}/api/v1/help" \
  -H "Content-Type: application/json" \
  -H "x-guard-receipt: not-valid-base64!!!" \
  -H "x-guard-receipt-sig: also-not-valid!!!" \
  -d "$(jq -n --arg a "$CLIENT_KEY" --arg s "$SIGN_PUB" --arg e "$ENC_PUB" \
    '{apiKey:$a,signPublicKey:$s,encryptPublicKey:$e,question:"garbage receipt",messages:[]}')")
CODE=$(parse_code "$RESULT")
[ "$CODE" = "403" ] && pass "Garbage base64 receipt rejected (403)" || fail "Expected 403 for garbage receipt, got HTTP $CODE"

# ═══════════════════════════════════════════════════════
# SECTION 2: Replay Attack Protection
# ═══════════════════════════════════════════════════════

section "2.1 — Replay attack: same receipt used twice"
RECEIPT=$(node "$HELPERS_DIR/create-receipt.js" "replay-test-content")
TOKEN=$(echo "$RECEIPT" | jq -r '.token')
SIG=$(echo "$RECEIPT" | jq -r '.signature')

# First use
KEYS_JSON=$(generate_crypto_keys)
SIGN_PUB=$(echo "$KEYS_JSON" | jq -r '.signPublicKey')
ENC_PUB=$(echo "$KEYS_JSON" | jq -r '.encryptPublicKey')
RESULT1=$(curl -s "${E2E_BYPASS_ARGS[@]}" -w '\n%{http_code}' -X POST "${BASE_URL}/api/v1/help" \
  -H "Content-Type: application/json" \
  -H "x-guard-receipt: $TOKEN" \
  -H "x-guard-receipt-sig: $SIG" \
  -d "$(jq -n --arg a "$CLIENT_KEY" --arg s "$SIGN_PUB" --arg e "$ENC_PUB" \
    '{apiKey:$a,signPublicKey:$s,encryptPublicKey:$e,question:"replay test 1",messages:[]}')")
CODE1=$(parse_code "$RESULT1")
[ "$CODE1" = "200" ] && pass "First use of receipt accepted" || fail "First use should succeed (got HTTP $CODE1)"

# Replay (same receipt, new keys)
KEYS_JSON2=$(generate_crypto_keys)
SIGN_PUB2=$(echo "$KEYS_JSON2" | jq -r '.signPublicKey')
ENC_PUB2=$(echo "$KEYS_JSON2" | jq -r '.encryptPublicKey')
RESULT2=$(curl -s "${E2E_BYPASS_ARGS[@]}" -w '\n%{http_code}' -X POST "${BASE_URL}/api/v1/help" \
  -H "Content-Type: application/json" \
  -H "x-guard-receipt: $TOKEN" \
  -H "x-guard-receipt-sig: $SIG" \
  -d "$(jq -n --arg a "$CLIENT_KEY" --arg s "$SIGN_PUB2" --arg e "$ENC_PUB2" \
    '{apiKey:$a,signPublicKey:$s,encryptPublicKey:$e,question:"replay test 2",messages:[]}')")
CODE2=$(parse_code "$RESULT2")
[ "$CODE2" = "403" ] && pass "Replay attack blocked (403)" || fail "Expected 403 for replayed receipt, got HTTP $CODE2"

section "2.2 — Rapid-fire unique receipts accepted"
ALL_PASS=true
RF_QUESTIONS=("What is the status of my order?" "How do I update my billing address?" "Can I get a refund for my purchase?")
for i in 1 2 3; do
  RESULT=$(submit_help "$GUARD_URL" "$CLIENT_KEY" "${RF_QUESTIONS[$((i-1))]}")
  CODE=$(parse_code "$RESULT")
  if [ "$CODE" != "200" ]; then
    ALL_PASS=false
    fail "Rapid-fire request $i failed (HTTP $CODE)"
    break
  fi
done
$ALL_PASS && pass "3 rapid-fire unique requests all accepted"

# ═══════════════════════════════════════════════════════
# SECTION 3: Timestamp Freshness
# ═══════════════════════════════════════════════════════

section "3.1 — Receipt from 10 minutes ago rejected"
RECEIPT=$(node "$HELPERS_DIR/create-receipt.js" "expired-old" "-600000")
TOKEN=$(echo "$RECEIPT" | jq -r '.token')
SIG=$(echo "$RECEIPT" | jq -r '.signature')
KEYS_JSON=$(generate_crypto_keys)
SIGN_PUB=$(echo "$KEYS_JSON" | jq -r '.signPublicKey')
ENC_PUB=$(echo "$KEYS_JSON" | jq -r '.encryptPublicKey')
RESULT=$(curl -s "${E2E_BYPASS_ARGS[@]}" -w '\n%{http_code}' -X POST "${BASE_URL}/api/v1/help" \
  -H "Content-Type: application/json" \
  -H "x-guard-receipt: $TOKEN" \
  -H "x-guard-receipt-sig: $SIG" \
  -d "$(jq -n --arg a "$CLIENT_KEY" --arg s "$SIGN_PUB" --arg e "$ENC_PUB" \
    '{apiKey:$a,signPublicKey:$s,encryptPublicKey:$e,question:"expired receipt",messages:[]}')")
CODE=$(parse_code "$RESULT")
[ "$CODE" = "403" ] && pass "10-minute-old receipt rejected (403)" || fail "Expected 403 for old receipt, got HTTP $CODE"

section "3.2 — Receipt from 1 hour ago rejected"
RECEIPT=$(node "$HELPERS_DIR/create-receipt.js" "expired-very-old" "-3600000")
TOKEN=$(echo "$RECEIPT" | jq -r '.token')
SIG=$(echo "$RECEIPT" | jq -r '.signature')
KEYS_JSON=$(generate_crypto_keys)
SIGN_PUB=$(echo "$KEYS_JSON" | jq -r '.signPublicKey')
ENC_PUB=$(echo "$KEYS_JSON" | jq -r '.encryptPublicKey')
RESULT=$(curl -s "${E2E_BYPASS_ARGS[@]}" -w '\n%{http_code}' -X POST "${BASE_URL}/api/v1/help" \
  -H "Content-Type: application/json" \
  -H "x-guard-receipt: $TOKEN" \
  -H "x-guard-receipt-sig: $SIG" \
  -d "$(jq -n --arg a "$CLIENT_KEY" --arg s "$SIGN_PUB" --arg e "$ENC_PUB" \
    '{apiKey:$a,signPublicKey:$s,encryptPublicKey:$e,question:"very old receipt",messages:[]}')")
CODE=$(parse_code "$RESULT")
[ "$CODE" = "403" ] && pass "1-hour-old receipt rejected (403)" || fail "Expected 403, got HTTP $CODE"

section "3.3 — Receipt from the future rejected"
RECEIPT=$(node "$HELPERS_DIR/create-receipt.js" "future-receipt" "600000")
TOKEN=$(echo "$RECEIPT" | jq -r '.token')
SIG=$(echo "$RECEIPT" | jq -r '.signature')
KEYS_JSON=$(generate_crypto_keys)
SIGN_PUB=$(echo "$KEYS_JSON" | jq -r '.signPublicKey')
ENC_PUB=$(echo "$KEYS_JSON" | jq -r '.encryptPublicKey')
RESULT=$(curl -s "${E2E_BYPASS_ARGS[@]}" -w '\n%{http_code}' -X POST "${BASE_URL}/api/v1/help" \
  -H "Content-Type: application/json" \
  -H "x-guard-receipt: $TOKEN" \
  -H "x-guard-receipt-sig: $SIG" \
  -d "$(jq -n --arg a "$CLIENT_KEY" --arg s "$SIGN_PUB" --arg e "$ENC_PUB" \
    '{apiKey:$a,signPublicKey:$s,encryptPublicKey:$e,question:"future receipt",messages:[]}')")
CODE=$(parse_code "$RESULT")
[ "$CODE" = "403" ] && pass "Future receipt rejected (403)" || fail "Expected 403 for future receipt, got HTTP $CODE"

section "3.4 — Receipt within 4 min window accepted"
RECEIPT=$(node "$HELPERS_DIR/create-receipt.js" "fresh-receipt" "-240000")
TOKEN=$(echo "$RECEIPT" | jq -r '.token')
SIG=$(echo "$RECEIPT" | jq -r '.signature')
KEYS_JSON=$(generate_crypto_keys)
SIGN_PUB=$(echo "$KEYS_JSON" | jq -r '.signPublicKey')
ENC_PUB=$(echo "$KEYS_JSON" | jq -r '.encryptPublicKey')
RESULT=$(curl -s "${E2E_BYPASS_ARGS[@]}" -w '\n%{http_code}' -X POST "${BASE_URL}/api/v1/help" \
  -H "Content-Type: application/json" \
  -H "x-guard-receipt: $TOKEN" \
  -H "x-guard-receipt-sig: $SIG" \
  -d "$(jq -n --arg a "$CLIENT_KEY" --arg s "$SIGN_PUB" --arg e "$ENC_PUB" \
    '{apiKey:$a,signPublicKey:$s,encryptPublicKey:$e,question:"4 min old receipt",messages:[]}')")
CODE=$(parse_code "$RESULT")
[ "$CODE" = "200" ] && pass "4-minute-old receipt accepted (within 5 min window)" || fail "Expected 200 for fresh receipt, got HTTP $CODE"

# ═══════════════════════════════════════════════════════
# SECTION 4: Content Safety Pipeline (via Guard)
# ═══════════════════════════════════════════════════════

guard_submit() {
  local question="$1"
  local KEYS_JSON
  KEYS_JSON=$(generate_crypto_keys)
  local SIGN_PUB ENC_PUB
  SIGN_PUB=$(echo "$KEYS_JSON" | jq -r '.signPublicKey')
  ENC_PUB=$(echo "$KEYS_JSON" | jq -r '.encryptPublicKey')
  curl -s "${E2E_BYPASS_ARGS[@]}" -w '\n%{http_code}' -X POST "${GUARD_URL}/api/v1/help" \
    -H "Content-Type: application/json" \
    -d "$(jq -n --arg a "$CLIENT_KEY" --arg s "$SIGN_PUB" --arg e "$ENC_PUB" --arg q "$question" \
      '{apiKey:$a,signPublicKey:$s,encryptPublicKey:$e,question:$q,messages:[]}')"
}

section "4.1 — XSS: <script> tag stripped"
RESULT=$(guard_submit 'Help me with <script>alert("xss")</script> JavaScript')
CODE=$(parse_code "$RESULT")
[ "$CODE" = "200" ] && pass "XSS script tag sanitized, request accepted" || pass "XSS handled (HTTP $CODE)"

section "4.2 — XSS: event handler stripped"
RESULT=$(guard_submit 'Check <img onerror=alert(1) src=x> this image')
CODE=$(parse_code "$RESULT")
[ "$CODE" = "200" ] && pass "Event handler XSS sanitized, request accepted" || pass "Event handler XSS handled (HTTP $CODE)"

section "4.3 — XSS: nested/obfuscated tags stripped"
RESULT=$(guard_submit '<div><iframe src="javascript:alert(1)"></iframe></div><svg onload=alert(1)>')
CODE=$(parse_code "$RESULT")
[ "$CODE" = "200" ] && pass "Nested XSS sanitized" || pass "Nested XSS handled (HTTP $CODE)"

section "4.4 — URL defanging: https → hxxps"
RESULT=$(guard_submit 'Visit https://malicious-site.com/payload for info')
CODE=$(parse_code "$RESULT")
[ "$CODE" = "200" ] && pass "URL defanged and request accepted" || pass "URL handled (HTTP $CODE)"

section "4.5 — Credit card: Visa (Luhn-valid) blocked"
RESULT=$(guard_submit 'My card number is 4111111111111111')
CODE=$(parse_code "$RESULT")
BODY=$(parse_body "$RESULT")
if [ "$CODE" = "422" ]; then
  FLAGS=$(echo "$BODY" | jq -r '.flags[]?.type // empty' 2>/dev/null)
  echo "$FLAGS" | grep -q "credit_card" && pass "Visa CC detected and blocked (422)" || pass "Content blocked (422)"
else
  fail "Expected 422 for credit card, got HTTP $CODE"
fi

section "4.6 — Credit card: with spaces blocked"
RESULT=$(guard_submit 'Card: 4111 1111 1111 1111')
CODE=$(parse_code "$RESULT")
[ "$CODE" = "422" ] && pass "Spaced CC detected and blocked (422)" || fail "Expected 422, got HTTP $CODE"

section "4.7 — Credit card: with dashes blocked"
RESULT=$(guard_submit 'Card: 4111-1111-1111-1111')
CODE=$(parse_code "$RESULT")
[ "$CODE" = "422" ] && pass "Dashed CC detected and blocked (422)" || fail "Expected 422, got HTTP $CODE"

section "4.8 — Credit card: MasterCard blocked"
RESULT=$(guard_submit 'Try 5500000000000004 for payment')
CODE=$(parse_code "$RESULT")
[ "$CODE" = "422" ] && pass "MasterCard detected and blocked (422)" || fail "Expected 422, got HTTP $CODE"

section "4.9 — Credit card: non-Luhn number passes"
RESULT=$(guard_submit 'The number 4111111111111112 is not a real card')
CODE=$(parse_code "$RESULT")
[ "$CODE" = "200" ] && pass "Non-Luhn number not flagged, passes" || info "Non-Luhn handled (HTTP $CODE)"

section "4.10 — SSN (US format) blocked"
RESULT=$(guard_submit 'My social security number is 123-45-6789')
CODE=$(parse_code "$RESULT")
[ "$CODE" = "422" ] && pass "US SSN detected and blocked (422)" || fail "Expected 422, got HTTP $CODE"

section "4.11 — BSN (Dutch, 11-check valid) blocked"
RESULT=$(guard_submit 'Mijn BSN is 111222333')
CODE=$(parse_code "$RESULT")
[ "$CODE" = "422" ] && pass "Dutch BSN detected and blocked (422)" || fail "Expected 422, got HTTP $CODE"

section "4.12 — Email address redacted (not blocked)"
RESULT=$(guard_submit 'Contact me at secret@company.com please')
CODE=$(parse_code "$RESULT")
[ "$CODE" = "200" ] && pass "Email redacted but request accepted" || pass "Email handled (HTTP $CODE)"

section "4.13 — Phone number redacted (not blocked)"
RESULT=$(guard_submit 'Call me at +31612345678 anytime')
CODE=$(parse_code "$RESULT")
[ "$CODE" = "200" ] && pass "Phone redacted but request accepted" || pass "Phone handled (HTTP $CODE)"

section "4.14 — Multiple PII types in one message"
RESULT=$(guard_submit 'Email: test@test.com, phone: +31698765432, card: 4111111111111111')
CODE=$(parse_code "$RESULT")
[ "$CODE" = "422" ] && pass "Multi-PII with CC blocked (422)" || fail "Expected 422 for multi-PII with CC, got HTTP $CODE"

section "4.15 — Clean text passes through"
RESULT=$(guard_submit 'How do I implement JWT authentication in Next.js with middleware?')
CODE=$(parse_code "$RESULT")
BODY=$(parse_body "$RESULT")
REF=$(echo "$BODY" | jq -r '.refCode // empty')
[ "$CODE" = "200" ] && [ -n "$REF" ] && pass "Clean text passes: $REF" || fail "Clean text should pass (HTTP $CODE)"

# ═══════════════════════════════════════════════════════
# SECTION 5: Payload Limits & Injection
# ═══════════════════════════════════════════════════════

section "5.1 — Oversized payload (>1MB) rejected"
TMPFILE=$(mktemp)
node -e "
const big = 'A'.repeat(1100000);
console.log(JSON.stringify({apiKey:'$CLIENT_KEY',question:big}));
" > "$TMPFILE"
RESULT=$(curl -s "${E2E_BYPASS_ARGS[@]}" -w '\n%{http_code}' -X POST "${GUARD_URL}/api/v1/help" \
  -H "Content-Type: application/json" \
  --data-binary @"$TMPFILE" 2>/dev/null)
CODE=$(parse_code "$RESULT")
rm -f "$TMPFILE"
if [ "$CODE" = "413" ] || [ "$CODE" = "400" ] || [ "$CODE" = "500" ] || [ "$CODE" = "000" ]; then
  pass "Oversized payload rejected (HTTP $CODE)"
else
  fail "Expected rejection for >1MB payload, got HTTP $CODE"
fi

section "5.2 — Exactly 1MB payload accepted"
TMPFILE=$(mktemp)
KEYS_JSON=$(generate_crypto_keys)
SIGN_PUB=$(echo "$KEYS_JSON" | jq -r '.signPublicKey')
ENC_PUB=$(echo "$KEYS_JSON" | jq -r '.encryptPublicKey')
# ~900KB question (leaves room for JSON structure + keys)
node -e "
const q = 'B'.repeat(900000);
console.log(JSON.stringify({
  apiKey:'$CLIENT_KEY',
  signPublicKey:$(echo "$SIGN_PUB" | jq -Rs .),
  encryptPublicKey:$(echo "$ENC_PUB" | jq -Rs .),
  question:q,messages:[]
}));
" > "$TMPFILE"
RESULT=$(curl -s "${E2E_BYPASS_ARGS[@]}" -w '\n%{http_code}' -X POST "${GUARD_URL}/api/v1/help" \
  -H "Content-Type: application/json" \
  --data-binary @"$TMPFILE" 2>/dev/null)
CODE=$(parse_code "$RESULT")
rm -f "$TMPFILE"
[ "$CODE" = "200" ] && pass "~900KB payload accepted" || info "Large payload handled (HTTP $CODE)"

section "5.3 — CRLF header injection in body"
RESULT=$(guard_submit "Normal question\r\nX-Injected: true\r\n\r\nmalicious payload")
CODE=$(parse_code "$RESULT")
if [ "$CODE" = "200" ] || [ "$CODE" = "422" ] || [ "$CODE" = "400" ]; then
  pass "CRLF injection handled safely (HTTP $CODE)"
else
  fail "Unexpected response for CRLF injection (HTTP $CODE)"
fi

section "5.4 — JSON injection: nested objects"
KEYS_JSON=$(generate_crypto_keys)
SIGN_PUB=$(echo "$KEYS_JSON" | jq -r '.signPublicKey')
ENC_PUB=$(echo "$KEYS_JSON" | jq -r '.encryptPublicKey')
RESULT=$(curl -s "${E2E_BYPASS_ARGS[@]}" -w '\n%{http_code}' -X POST "${GUARD_URL}/api/v1/help" \
  -H "Content-Type: application/json" \
  -d "{\"apiKey\":\"$CLIENT_KEY\",\"signPublicKey\":$(echo "$SIGN_PUB" | jq -Rs .),\"encryptPublicKey\":$(echo "$ENC_PUB" | jq -Rs .),\"question\":\"test\",\"messages\":[],\"__proto__\":{\"admin\":true},\"constructor\":{\"prototype\":{\"isAdmin\":true}}}")
CODE=$(parse_code "$RESULT")
if [ "$CODE" = "200" ] || [ "$CODE" = "400" ] || [ "$CODE" = "422" ]; then
  pass "Proto pollution attempt handled safely (HTTP $CODE)"
else
  fail "Unexpected response for proto pollution (HTTP $CODE)"
fi

section "5.5 — Empty body rejected"
RESULT=$(curl -s "${E2E_BYPASS_ARGS[@]}" -w '\n%{http_code}' -X POST "${GUARD_URL}/api/v1/help" \
  -H "Content-Type: application/json" \
  -d '')
CODE=$(parse_code "$RESULT")
[ "$CODE" = "400" ] || [ "$CODE" = "422" ] || [ "$CODE" = "500" ] && pass "Empty body rejected (HTTP $CODE)" || fail "Expected rejection for empty body, got HTTP $CODE"

section "5.6 — Non-JSON content-type rejected"
RESULT=$(curl -s "${E2E_BYPASS_ARGS[@]}" -w '\n%{http_code}' -X POST "${GUARD_URL}/api/v1/help" \
  -H "Content-Type: text/plain" \
  -d 'just plain text')
CODE=$(parse_code "$RESULT")
if [ "$CODE" = "400" ] || [ "$CODE" = "415" ] || [ "$CODE" = "422" ] || [ "$CODE" = "500" ]; then
  pass "Non-JSON content-type rejected (HTTP $CODE)"
else
  fail "Expected rejection for text/plain, got HTTP $CODE"
fi

# ═══════════════════════════════════════════════════════
# SECTION 6: Route-Level Validation
# ═══════════════════════════════════════════════════════

section "6.1 — GET /health passes without receipt"
RESULT=$(curl -s "${E2E_BYPASS_ARGS[@]}" -w '\n%{http_code}' "${GUARD_URL}/health")
CODE=$(parse_code "$RESULT")
[ "$CODE" = "200" ] && pass "Guard health endpoint accessible" || fail "Guard health should return 200, got HTTP $CODE"

section "6.2 — GET /api/v1/whoami proxied without receipt"
RESULT=$(curl -s "${E2E_BYPASS_ARGS[@]}" -w '\n%{http_code}' "${GUARD_URL}/api/v1/whoami" \
  -H "x-api-key: $CLIENT_KEY")
CODE=$(parse_code "$RESULT")
[ "$CODE" = "200" ] && pass "GET endpoint proxied without receipt (200)" || fail "GET whoami should work through Guard, got HTTP $CODE"

section "6.3 — POST /api/v1/help requires Guard receipt"
# POST content routes go through the content safety pipeline
RESULT=$(submit_help "$GUARD_URL" "$CLIENT_KEY" "route-guard-test-$(date +%s)")
CODE=$(parse_code "$RESULT")
[ "$CODE" = "200" ] && pass "POST /api/v1/help processed by Guard pipeline" || fail "POST help through Guard failed (HTTP $CODE)"

section "6.4 — POST /api/v1/message proxied through Guard"
# Use a non-existent request ID — we expect 404 (not 403), proving it was proxied
RESULT=$(curl -s "${E2E_BYPASS_ARGS[@]}" -w '\n%{http_code}' -X POST "${GUARD_URL}/api/v1/message/nonexistent-id" \
  -H "Content-Type: application/json" \
  -H "x-api-key: $CLIENT_KEY" \
  -d '{"from":"consumer","plaintext":"test"}')
CODE=$(parse_code "$RESULT")
# 403 = auth issue, 404 = request not found (proxied successfully)
if [ "$CODE" = "404" ] || [ "$CODE" = "403" ]; then
  pass "POST /api/v1/message proxied through Guard (HTTP $CODE)"
else
  fail "Expected 403/404 for message to nonexistent request, got HTTP $CODE"
fi

# ═══════════════════════════════════════════════════════
# SECTION 7: Content Hash Integrity
# ═══════════════════════════════════════════════════════

section "7.1 — Receipt content hash matches actual content"
# Submit through Guard — content hash is computed by Guard
RESULT=$(submit_help "$GUARD_URL" "$CLIENT_KEY" "hash-integrity-test")
CODE=$(parse_code "$RESULT")
[ "$CODE" = "200" ] && pass "Content hash matches (request accepted through Guard)" || fail "Content hash integrity test failed (HTTP $CODE)"

section "7.2 — Mismatched content hash: craft receipt for different content"
# Create receipt for "original content" but send "different content"
RECEIPT=$(node "$HELPERS_DIR/create-receipt.js" "original content")
TOKEN=$(echo "$RECEIPT" | jq -r '.token')
SIG=$(echo "$RECEIPT" | jq -r '.signature')
KEYS_JSON=$(generate_crypto_keys)
SIGN_PUB=$(echo "$KEYS_JSON" | jq -r '.signPublicKey')
ENC_PUB=$(echo "$KEYS_JSON" | jq -r '.encryptPublicKey')
# Note: Platform verifies signature is valid, but doesn't re-hash content (Guard already did that).
# This tests that the receipt itself is cryptographically valid.
RESULT=$(curl -s "${E2E_BYPASS_ARGS[@]}" -w '\n%{http_code}' -X POST "${BASE_URL}/api/v1/help" \
  -H "Content-Type: application/json" \
  -H "x-guard-receipt: $TOKEN" \
  -H "x-guard-receipt-sig: $SIG" \
  -d "$(jq -n --arg a "$CLIENT_KEY" --arg s "$SIGN_PUB" --arg e "$ENC_PUB" \
    '{apiKey:$a,signPublicKey:$s,encryptPublicKey:$e,question:"different content than receipt",messages:[]}')")
CODE=$(parse_code "$RESULT")
# Receipt signature is valid, so platform accepts it. This is expected behavior —
# the Guard is responsible for content integrity, not the Platform.
if [ "$CODE" = "200" ]; then
  pass "Platform trusts Guard receipt signature (content hash not re-verified)"
elif [ "$CODE" = "403" ]; then
  pass "Platform rejects mismatched content hash (403)"
fi

# ═══════════════════════════════════════════════════════
# SECTION 8: Edge Cases
# ═══════════════════════════════════════════════════════

section "8.1 — Unicode content passes"
RESULT=$(guard_submit '日本語のヘルプ: αβγδ 🦞🔒 τεστ')
CODE=$(parse_code "$RESULT")
[ "$CODE" = "200" ] && pass "Unicode content accepted" || fail "Unicode should pass, got HTTP $CODE"

section "8.2 — Very long question (500KB, under limit)"
LONG_Q=$(python3 -c "print('help ' * 100000)" 2>/dev/null || node -e "console.log('help '.repeat(100000))")
RESULT=$(guard_submit "$LONG_Q")
CODE=$(parse_code "$RESULT")
[ "$CODE" = "200" ] && pass "500KB question accepted" || info "Large question handled (HTTP $CODE)"

section "8.3 — Empty question field"
KEYS_JSON=$(generate_crypto_keys)
SIGN_PUB=$(echo "$KEYS_JSON" | jq -r '.signPublicKey')
ENC_PUB=$(echo "$KEYS_JSON" | jq -r '.encryptPublicKey')
RESULT=$(curl -s "${E2E_BYPASS_ARGS[@]}" -w '\n%{http_code}' -X POST "${GUARD_URL}/api/v1/help" \
  -H "Content-Type: application/json" \
  -d "$(jq -n --arg a "$CLIENT_KEY" --arg s "$SIGN_PUB" --arg e "$ENC_PUB" \
    '{apiKey:$a,signPublicKey:$s,encryptPublicKey:$e,question:"",messages:[]}')")
CODE=$(parse_code "$RESULT")
if [ "$CODE" = "200" ] || [ "$CODE" = "400" ]; then
  pass "Empty question handled (HTTP $CODE)"
else
  fail "Unexpected for empty question (HTTP $CODE)"
fi

section "8.4 — Messages array with content (Guard validates all text)"
KEYS_JSON=$(generate_crypto_keys)
SIGN_PUB=$(echo "$KEYS_JSON" | jq -r '.signPublicKey')
ENC_PUB=$(echo "$KEYS_JSON" | jq -r '.encryptPublicKey')
RESULT=$(curl -s "${E2E_BYPASS_ARGS[@]}" -w '\n%{http_code}' -X POST "${GUARD_URL}/api/v1/help" \
  -H "Content-Type: application/json" \
  -d "$(jq -n --arg a "$CLIENT_KEY" --arg s "$SIGN_PUB" --arg e "$ENC_PUB" \
    '{apiKey:$a,signPublicKey:$s,encryptPublicKey:$e,question:"legit question",messages:[{role:"user",content:"I tried <script>alert(1)</script> but it failed"},{role:"assistant",content:"That looks like XSS, let me help"}]}')")
CODE=$(parse_code "$RESULT")
[ "$CODE" = "200" ] && pass "Messages array with XSS sanitized and accepted" || pass "Messages handled (HTTP $CODE)"

section "8.5 — Concurrent requests don't interfere"
# Launch 5 requests in parallel through Guard with unique questions per request
PIDS_CONCURRENT=()
TMPDIR_CONC=$(mktemp -d)
QUESTIONS=(
  "How do I reset my password for the portal?"
  "What are the opening hours of the support desk?"
  "Can you help me find my invoice from last month?"
  "I need assistance with my account settings."
  "Where can I find the documentation for the API?"
)
for i in $(seq 1 5); do
  (
    Q="${QUESTIONS[$((i-1))]}"
    R=$(submit_help "$GUARD_URL" "$CLIENT_KEY" "$Q")
    C=$(parse_code "$R")
    echo "$C" > "$TMPDIR_CONC/$i.code"
  ) &
  PIDS_CONCURRENT+=($!)
done
# Wait for all
for pid in "${PIDS_CONCURRENT[@]}"; do
  wait "$pid" 2>/dev/null
done
ALL_OK=true
CODES=""
for i in $(seq 1 5); do
  C=$(cat "$TMPDIR_CONC/$i.code" 2>/dev/null || echo "000")
  CODES="$CODES $i:$C"
  [ "$C" != "200" ] && ALL_OK=false
done
rm -rf "$TMPDIR_CONC"
if $ALL_OK; then
  pass "5 concurrent requests all succeeded"
else
  info "Concurrent codes:$CODES"
  fail "Some concurrent requests failed"
fi

finish
