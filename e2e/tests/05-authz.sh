#!/bin/bash
# HeySummon E2E — 05: Authorization & access control
set -uo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../lib.sh"

echo ""
echo "══════════════════════════════════════════"
echo "  🧪 05 — Authorization & Access Control"
echo "══════════════════════════════════════════"

# Determine test URL (prefer Guard if available, fall back to direct)
TEST_URL="$GUARD_URL"
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "${GUARD_URL}/health" 2>/dev/null || echo "000")
if [ "$HTTP_CODE" != "200" ]; then
  TEST_URL="$BASE_URL"
  info "Guard not available, using direct platform URL"
fi

# ── Test: Provider cannot send message without consumer request first ──
section "Provider Cannot Initiate"
# Try to send a message to a non-existent request ID
RESULT=$(curl -s -w '\n%{http_code}' -X POST "${BASE_URL}/api/v1/message/nonexistent-request-id" \
  -H "x-api-key: ${PROVIDER_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"from": "provider", "plaintext": "unsolicited reply"}')
CODE=$(parse_code "$RESULT")

if [ "$CODE" = "403" ] || [ "$CODE" = "404" ]; then
  pass "Provider cannot message without consumer request ($CODE)"
else
  fail "Expected 403/404 for unsolicited provider message, got HTTP $CODE"
fi

# ── Test: Wrong provider cannot respond to another provider's request ──
section "Wrong Provider Cannot Respond"
if [ -z "$PROVIDER2_KEY" ]; then
  skip "E2E_PROVIDER2_KEY not set — skipping wrong-provider test"
else
  # First, create a request owned by provider A
  RESULT=$(submit_help "$TEST_URL" "$CLIENT_KEY" "authz-wrong-provider-test")
  CODE=$(parse_code "$RESULT")
  BODY=$(parse_body "$RESULT")
  REQUEST_ID=$(echo "$BODY" | jq -r '.requestId // empty')

  if [ "$CODE" = "200" ] && [ -n "$REQUEST_ID" ]; then
    # Provider B tries to respond
    RESULT2=$(curl -s -w '\n%{http_code}' -X POST "${BASE_URL}/api/v1/message/${REQUEST_ID}" \
      -H "x-api-key: ${PROVIDER2_KEY}" \
      -H "Content-Type: application/json" \
      -d '{"from": "provider", "plaintext": "wrong provider reply"}')
    CODE2=$(parse_code "$RESULT2")

    [ "$CODE2" = "403" ] && pass "Wrong provider rejected (403)" || fail "Expected 403 for wrong provider, got HTTP $CODE2"
  else
    fail "Could not create request for wrong-provider test (HTTP $CODE)"
  fi
fi

# ── Test: Invalid API key returns 401 ──
section "Invalid API Key"
RESULT=$(curl -s -w '\n%{http_code}' "${BASE_URL}/api/v1/whoami" \
  -H "x-api-key: hs_cli_this_key_does_not_exist_at_all")
CODE=$(parse_code "$RESULT")

[ "$CODE" = "401" ] && pass "Invalid API key rejected (401)" || fail "Expected 401 for invalid key, got HTTP $CODE"

# ── Test: Deactivated key returns 401 ──
section "Deactivated Key"
if [ -z "$INACTIVE_KEY" ]; then
  skip "E2E_INACTIVE_KEY not set — skipping deactivated key test"
else
  RESULT=$(curl -s -w '\n%{http_code}' "${BASE_URL}/api/v1/whoami" \
    -H "x-api-key: ${INACTIVE_KEY}")
  CODE=$(parse_code "$RESULT")

  [ "$CODE" = "401" ] && pass "Deactivated key rejected (401)" || fail "Expected 401 for deactivated key, got HTTP $CODE"
fi

# ── Test: Device token binding ──
section "Device Token Binding"
if [ -z "$DEVICE_KEY" ] || [ -z "$DEVICE_TOKEN" ]; then
  skip "E2E_DEVICE_KEY/E2E_DEVICE_TOKEN not set — skipping device token test"
else
  # Without device token → 403
  RESULT=$(curl -s -w '\n%{http_code}' "${BASE_URL}/api/v1/whoami" \
    -H "x-api-key: ${DEVICE_KEY}")
  CODE=$(parse_code "$RESULT")
  [ "$CODE" = "403" ] && pass "Missing device token rejected (403)" || fail "Expected 403 without device token, got HTTP $CODE"

  # With wrong device token → 403
  RESULT=$(curl -s -w '\n%{http_code}' "${BASE_URL}/api/v1/whoami" \
    -H "x-api-key: ${DEVICE_KEY}" \
    -H "x-device-token: wrong-token-value")
  CODE=$(parse_code "$RESULT")
  [ "$CODE" = "403" ] && pass "Wrong device token rejected (403)" || fail "Expected 403 with wrong device token, got HTTP $CODE"

  # With correct device token → 200
  RESULT=$(curl -s -w '\n%{http_code}' "${BASE_URL}/api/v1/whoami" \
    -H "x-api-key: ${DEVICE_KEY}" \
    -H "x-device-token: ${DEVICE_TOKEN}")
  CODE=$(parse_code "$RESULT")
  [ "$CODE" = "200" ] && pass "Correct device token accepted (200)" || fail "Expected 200 with correct device token, got HTTP $CODE"
fi

finish
