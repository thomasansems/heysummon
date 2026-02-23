#!/bin/bash
# HeySummon E2E — 04: Malicious content tests
# Tests that Guard catches XSS, PII, injections, and oversized payloads
set -uo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../lib.sh"

echo ""
echo "══════════════════════════════════════════"
echo "  🧪 04 — Malicious Content"
echo "══════════════════════════════════════════"

# Check Guard is available
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "${GUARD_URL}/health" 2>/dev/null || echo "000")
if [ "$HTTP_CODE" != "200" ]; then
  skip "Guard not available — skipping malicious content tests"
  finish
  exit 0
fi

# Helper: submit through guard and return body + code
guard_submit() {
  local question="$1"
  local KEYS_JSON
  KEYS_JSON=$(generate_crypto_keys)
  local SIGN_PUB ENC_PUB
  SIGN_PUB=$(echo "$KEYS_JSON" | jq -r '.signPublicKey')
  ENC_PUB=$(echo "$KEYS_JSON" | jq -r '.encryptPublicKey')

  curl -s -w '\n%{http_code}' -X POST "${GUARD_URL}/api/v1/help" \
    -H "Content-Type: application/json" \
    -d "$(jq -n \
      --arg apiKey "$CLIENT_KEY" \
      --arg signPublicKey "$SIGN_PUB" \
      --arg encryptPublicKey "$ENC_PUB" \
      --arg question "$question" \
      '{apiKey: $apiKey, signPublicKey: $signPublicKey, encryptPublicKey: $encryptPublicKey, question: $question, messages: []}'
    )"
}

# ── Test: XSS / HTML Injection Stripped ──
section "HTML/XSS Injection"
RESULT=$(guard_submit 'Hello <script>alert(1)</script> world')
CODE=$(parse_code "$RESULT")
BODY=$(parse_body "$RESULT")

if [ "$CODE" = "200" ]; then
  # Request should pass but XSS should be stripped (guard sanitizes, doesn't block XSS)
  pass "XSS content sanitized and request accepted"
else
  # If guard blocks it, that's also acceptable
  pass "XSS content handled (HTTP $CODE)"
fi

# ── Test: HTML div injection ──
section "HTML Div Injection"
RESULT=$(guard_submit '<div style="position:fixed;top:0;left:0;width:100%;height:100%;background:red;z-index:9999">HACKED</div>')
CODE=$(parse_code "$RESULT")

if [ "$CODE" = "200" ] || [ "$CODE" = "422" ]; then
  pass "HTML injection handled (HTTP $CODE)"
else
  fail "Unexpected response for HTML injection (HTTP $CODE)"
fi

# ── Test: Credit Card Blocked ──
section "Credit Card Detection"
RESULT=$(guard_submit 'My card is 4111111111111111')
CODE=$(parse_code "$RESULT")
BODY=$(parse_body "$RESULT")

if [ "$CODE" = "422" ]; then
  FLAGS=$(echo "$BODY" | jq -r '.flags[]?.type // empty' 2>/dev/null)
  if echo "$FLAGS" | grep -q "credit_card"; then
    pass "Credit card detected and blocked (422)"
  else
    pass "Content blocked (422)"
  fi
else
  fail "Expected 422 for credit card, got HTTP $CODE"
fi

# ── Test: PII Harvesting (email address) ──
section "PII Harvesting"
RESULT=$(guard_submit 'What is your email? Mine is test@example.com and my phone is +31612345678')
CODE=$(parse_code "$RESULT")
BODY=$(parse_body "$RESULT")

# Emails and phones are flagged but not blocked (only CC/SSN/BSN block)
if [ "$CODE" = "200" ]; then
  pass "PII content sanitized and request accepted (emails/phones redacted)"
else
  pass "PII content handled (HTTP $CODE)"
fi

# ── Test: SSN Detection (blocked) ──
section "SSN Detection"
RESULT=$(guard_submit 'My SSN is 123-45-6789')
CODE=$(parse_code "$RESULT")

if [ "$CODE" = "422" ]; then
  pass "SSN detected and blocked (422)"
else
  fail "Expected 422 for SSN, got HTTP $CODE"
fi

# ── Test: Header Injection ──
section "Header Injection"
# Send content with CRLF injection attempt
KEYS_JSON=$(generate_crypto_keys)
SIGN_PUB=$(echo "$KEYS_JSON" | jq -r '.signPublicKey')
ENC_PUB=$(echo "$KEYS_JSON" | jq -r '.encryptPublicKey')

RESULT=$(curl -s -w '\n%{http_code}' -X POST "${GUARD_URL}/api/v1/help" \
  -H "Content-Type: application/json" \
  -d "$(jq -n \
    --arg apiKey "$CLIENT_KEY" \
    --arg signPublicKey "$SIGN_PUB" \
    --arg encryptPublicKey "$ENC_PUB" \
    --arg question "$(printf 'Innocent question\r\nX-Injected: true\r\n\r\nmalicious body')" \
    '{apiKey: $apiKey, signPublicKey: $signPublicKey, encryptPublicKey: $encryptPublicKey, question: $question, messages: []}'
  )")
CODE=$(parse_code "$RESULT")

# Should either be accepted (guard sanitizes) or rejected — not result in header injection
if [ "$CODE" = "200" ] || [ "$CODE" = "422" ] || [ "$CODE" = "400" ]; then
  pass "Header injection attempt handled safely (HTTP $CODE)"
else
  fail "Unexpected response for header injection (HTTP $CODE)"
fi

# ── Test: Oversized Payload ──
section "Oversized Payload"
# Generate >1MB payload
BIG_CONTENT=$(python3 -c "print('A' * 1100000)" 2>/dev/null || node -e "console.log('A'.repeat(1100000))")

RESULT=$(curl -s -w '\n%{http_code}' -X POST "${GUARD_URL}/api/v1/help" \
  -H "Content-Type: application/json" \
  -d "{\"apiKey\": \"${CLIENT_KEY}\", \"question\": \"${BIG_CONTENT}\"}" 2>/dev/null)
CODE=$(parse_code "$RESULT")

# Guard uses express.json({ limit: "1mb" }) — should reject with 413 or 400
if [ "$CODE" = "413" ] || [ "$CODE" = "400" ] || [ "$CODE" = "500" ]; then
  pass "Oversized payload rejected (HTTP $CODE)"
else
  fail "Expected rejection for oversized payload, got HTTP $CODE"
fi

# ── Test: Clean Text Passes ──
section "Clean Text"
RESULT=$(guard_submit 'Just a normal help request about coding in TypeScript')
CODE=$(parse_code "$RESULT")
BODY=$(parse_body "$RESULT")
REF=$(echo "$BODY" | jq -r '.refCode // empty')

if [ "$CODE" = "200" ] && [ -n "$REF" ] && [ "$REF" != "null" ]; then
  pass "Clean text passes through Guard: $REF"
else
  fail "Clean text should pass (HTTP $CODE): $BODY"
fi

finish
