#!/bin/bash
# HeySummon E2E — 10: Provider cannot send unsolicited messages
# A provider must NEVER be able to push messages to a client without
# an active help request existing first. This test verifies that.
set -uo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../lib.sh"

echo ""
echo "══════════════════════════════════════════════════════"
echo "  🧪 10 — Unsolicited Provider Messages (must be blocked)"
echo "══════════════════════════════════════════════════════"

# ── 1. Provider cannot message a nonexistent request ──────────────────────
section "1. Provider → nonexistent request ID → must be 403/404"
RESULT=$(curl -s "${E2E_BYPASS_ARGS[@]}" -w '\n%{http_code}' \
  -X POST "${BASE_URL}/api/v1/message/nonexistent-request-id-$(date +%s)" \
  -H "Content-Type: application/json" \
  -H "x-api-key: ${PROVIDER_KEY}" \
  -d '{"from":"provider","plaintext":"Hello, did you need help?"}')
CODE=$(parse_code "$RESULT")
[ "$CODE" = "403" ] || [ "$CODE" = "404" ] \
  && pass "Nonexistent request rejected ($CODE)" \
  || fail "Expected 403/404 for nonexistent request, got HTTP $CODE"

# ── 2. Provider cannot message a request that belongs to another provider ──
section "2. Provider A → request owned by Provider B → must be 403"
# First create a request under provider B's client
RESULT_B=$(submit_help "$BASE_URL" "$PROVIDER2_CLIENT_KEY" "provider-b-request $(date +%s)")
CODE_B=$(parse_code "$RESULT_B")
BODY_B=$(parse_body "$RESULT_B")
REQUEST_ID_B=$(echo "$BODY_B" | jq -r '.requestId // empty')

if [ "$CODE_B" != "200" ] || [ -z "$REQUEST_ID_B" ]; then
  skip "Could not create Provider B request (HTTP $CODE_B) — skipping cross-provider test"
else
  # Provider A tries to send a message to Provider B's request
  RESULT=$(curl -s "${E2E_BYPASS_ARGS[@]}" -w '\n%{http_code}' \
    -X POST "${BASE_URL}/api/v1/message/${REQUEST_ID_B}" \
    -H "Content-Type: application/json" \
    -H "x-api-key: ${PROVIDER_KEY}" \
    -d '{"from":"provider","plaintext":"Unsolicited from Provider A"}')
  CODE=$(parse_code "$RESULT")
  [ "$CODE" = "403" ] \
    && pass "Cross-provider message rejected (403)" \
    || fail "Expected 403 — Provider A should not message Provider B's request, got HTTP $CODE"
fi

# ── 3. Provider cannot message a CLOSED request ───────────────────────────
section "3. Provider → closed request → must be 403/404"
# Create a request, then close it, then try to message it
RESULT_NEW=$(submit_help "$BASE_URL" "$CLIENT_KEY" "close-me $(date +%s)")
CODE_NEW=$(parse_code "$RESULT_NEW")
BODY_NEW=$(parse_body "$RESULT_NEW")
REQUEST_ID_NEW=$(echo "$BODY_NEW" | jq -r '.requestId // empty')

if [ "$CODE_NEW" != "200" ] || [ -z "$REQUEST_ID_NEW" ]; then
  skip "Could not create request for close test (HTTP $CODE_NEW)"
else
  # Close it
  CLOSE_CODE=$(curl -s "${E2E_BYPASS_ARGS[@]}" -o /dev/null -w "%{http_code}" \
    -X POST "${BASE_URL}/api/v1/close/${REQUEST_ID_NEW}" \
    -H "x-api-key: ${PROVIDER_KEY}")

  if [ "$CLOSE_CODE" = "200" ]; then
    # Try to message the now-closed request
    RESULT=$(curl -s "${E2E_BYPASS_ARGS[@]}" -w '\n%{http_code}' \
      -X POST "${BASE_URL}/api/v1/message/${REQUEST_ID_NEW}" \
      -H "Content-Type: application/json" \
      -H "x-api-key: ${PROVIDER_KEY}" \
      -d '{"from":"provider","plaintext":"Message after close"}')
    CODE=$(parse_code "$RESULT")
    [ "$CODE" = "403" ] || [ "$CODE" = "404" ] || [ "$CODE" = "400" ] \
      && pass "Message to closed request rejected ($CODE)" \
      || fail "Expected 403/404 — provider should not message closed request, got HTTP $CODE"
  else
    skip "Could not close request (HTTP $CLOSE_CODE)"
  fi
fi

# ── 4. Client key cannot impersonate provider (send as 'provider') ─────────
section "4. Client key pretending to be provider → must be 401/403"
# Create a real request first
RESULT_REAL=$(submit_help "$BASE_URL" "$CLIENT_KEY" "impersonation-test $(date +%s)")
CODE_REAL=$(parse_code "$RESULT_REAL")
BODY_REAL=$(parse_body "$RESULT_REAL")
REQUEST_ID_REAL=$(echo "$BODY_REAL" | jq -r '.requestId // empty')

if [ "$CODE_REAL" != "200" ] || [ -z "$REQUEST_ID_REAL" ]; then
  skip "Could not create request for impersonation test"
else
  RESULT=$(curl -s "${E2E_BYPASS_ARGS[@]}" -w '\n%{http_code}' \
    -X POST "${BASE_URL}/api/v1/message/${REQUEST_ID_REAL}" \
    -H "Content-Type: application/json" \
    -H "x-api-key: ${CLIENT_KEY}" \
    -d '{"from":"provider","plaintext":"Fake provider message from client key"}')
  CODE=$(parse_code "$RESULT")
  [ "$CODE" = "401" ] || [ "$CODE" = "403" ] \
    && pass "Client-key-as-provider rejected ($CODE)" \
    || fail "Expected 401/403 — client key must not send as provider, got HTTP $CODE"
fi

# ── 5. Provider without valid key cannot send ──────────────────────────────
section "5. No API key → must be 401"
RESULT=$(curl -s "${E2E_BYPASS_ARGS[@]}" -w '\n%{http_code}' \
  -X POST "${BASE_URL}/api/v1/message/any-request-id" \
  -H "Content-Type: application/json" \
  -d '{"from":"provider","plaintext":"Anonymous message"}')
CODE=$(parse_code "$RESULT")
[ "$CODE" = "401" ] \
  && pass "No API key rejected (401)" \
  || fail "Expected 401 for missing API key, got HTTP $CODE"

finish
