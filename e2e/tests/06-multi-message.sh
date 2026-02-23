#!/bin/bash
# HeySummon E2E — 06: Multi-message flow tests
set -uo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../lib.sh"

echo ""
echo "══════════════════════════════════════════"
echo "  🧪 06 — Multi-Message Flows"
echo "══════════════════════════════════════════"

# Determine test URL
TEST_URL="$GUARD_URL"
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "${GUARD_URL}/health" 2>/dev/null || echo "000")
if [ "$HTTP_CODE" != "200" ]; then
  TEST_URL="$BASE_URL"
fi

# ── Setup: Create a request for multi-message testing ──
section "Setup: Create Request"
RESULT=$(submit_help "$TEST_URL" "$CLIENT_KEY" "multi-message-test $(date +%s)")
CODE=$(parse_code "$RESULT")
BODY=$(parse_body "$RESULT")
REQUEST_ID=$(echo "$BODY" | jq -r '.requestId // empty')
REF_CODE=$(echo "$BODY" | jq -r '.refCode // empty')

if [ "$CODE" != "200" ] || [ -z "$REQUEST_ID" ]; then
  fail "Could not create request for multi-message test (HTTP $CODE)"
  finish
  exit 1
fi
pass "Request created: $REF_CODE ($REQUEST_ID)"

# ── Test: Provider sends multiple responses ──
section "Provider Multiple Responses"

# Send first reply
REPLY1=$(curl -s -X POST "${BASE_URL}/api/v1/message/${REQUEST_ID}" \
  -H "x-api-key: ${PROVIDER_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"from": "provider", "plaintext": "First reply from provider"}')
REPLY1_OK=$(echo "$REPLY1" | jq -r '.success // empty')
[ "$REPLY1_OK" = "true" ] && pass "Provider sent first reply" || fail "First reply failed: $REPLY1"

# Send second reply
REPLY2=$(curl -s -X POST "${BASE_URL}/api/v1/message/${REQUEST_ID}" \
  -H "x-api-key: ${PROVIDER_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"from": "provider", "plaintext": "Second reply from provider"}')
REPLY2_OK=$(echo "$REPLY2" | jq -r '.success // empty')
[ "$REPLY2_OK" = "true" ] && pass "Provider sent second reply" || fail "Second reply failed: $REPLY2"

# Send third reply
REPLY3=$(curl -s -X POST "${BASE_URL}/api/v1/message/${REQUEST_ID}" \
  -H "x-api-key: ${PROVIDER_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"from": "provider", "plaintext": "Third reply from provider"}')
REPLY3_OK=$(echo "$REPLY3" | jq -r '.success // empty')
[ "$REPLY3_OK" = "true" ] && pass "Provider sent third reply" || fail "Third reply failed: $REPLY3"

# ── Test: Consumer sends follow-up ──
section "Consumer Follow-up"
FOLLOWUP=$(curl -s -X POST "${BASE_URL}/api/v1/message/${REQUEST_ID}" \
  -H "x-api-key: ${CLIENT_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"from": "consumer", "plaintext": "Follow-up question from consumer"}')
FOLLOWUP_OK=$(echo "$FOLLOWUP" | jq -r '.success // empty')
[ "$FOLLOWUP_OK" = "true" ] && pass "Consumer sent follow-up" || fail "Follow-up failed: $FOLLOWUP"

# ── Test: Message ordering ──
section "Message Ordering"
MESSAGES=$(curl -s "${BASE_URL}/api/v1/messages/${REQUEST_ID}")
MSG_COUNT=$(echo "$MESSAGES" | jq '.messages | length' 2>/dev/null || echo "0")

if [ "$MSG_COUNT" -ge 4 ]; then
  pass "All $MSG_COUNT messages stored"

  # Verify order: first 3 from provider, last from consumer
  FROM_1=$(echo "$MESSAGES" | jq -r '.messages[0].from')
  FROM_2=$(echo "$MESSAGES" | jq -r '.messages[1].from')
  FROM_3=$(echo "$MESSAGES" | jq -r '.messages[2].from')
  FROM_4=$(echo "$MESSAGES" | jq -r '.messages[3].from')

  if [ "$FROM_1" = "provider" ] && [ "$FROM_2" = "provider" ] && \
     [ "$FROM_3" = "provider" ] && [ "$FROM_4" = "consumer" ]; then
    pass "Messages in correct order (3 provider, 1 consumer)"
  else
    fail "Unexpected message order: $FROM_1, $FROM_2, $FROM_3, $FROM_4"
  fi

  # Verify chronological order (each createdAt >= previous)
  TIMESTAMPS=$(echo "$MESSAGES" | jq '[.messages[].createdAt] | sort == [.messages[].createdAt]')
  [ "$TIMESTAMPS" = "true" ] && pass "Messages in chronological order" || fail "Messages not in chronological order"
else
  fail "Expected at least 4 messages, got $MSG_COUNT"
fi

# ── Test: messageCount parameter trims messages ──
section "messageCount Trimming"
KEYS_JSON=$(generate_crypto_keys)
SIGN_PUB=$(echo "$KEYS_JSON" | jq -r '.signPublicKey')
ENC_PUB=$(echo "$KEYS_JSON" | jq -r '.encryptPublicKey')

# Submit with 5 messages but messageCount=2 — should only store last 2
TRIM_RESULT=$(curl -s -w '\n%{http_code}' -X POST "${TEST_URL}/api/v1/help" \
  -H "Content-Type: application/json" \
  -d "$(jq -n \
    --arg apiKey "$CLIENT_KEY" \
    --arg signPublicKey "$SIGN_PUB" \
    --arg encryptPublicKey "$ENC_PUB" \
    '{
      apiKey: $apiKey,
      signPublicKey: $signPublicKey,
      encryptPublicKey: $encryptPublicKey,
      question: "messageCount trim test",
      messageCount: 2,
      messages: [
        {role: "user", content: "msg1"},
        {role: "assistant", content: "msg2"},
        {role: "user", content: "msg3"},
        {role: "assistant", content: "msg4"},
        {role: "user", content: "msg5"}
      ]
    }'
  )")
TRIM_CODE=$(parse_code "$TRIM_RESULT")
TRIM_BODY=$(parse_body "$TRIM_RESULT")

if [ "$TRIM_CODE" = "200" ]; then
  TRIM_REF=$(echo "$TRIM_BODY" | jq -r '.refCode // empty')
  pass "Request with messageCount=2 accepted: $TRIM_REF"
else
  fail "messageCount trim request failed (HTTP $TRIM_CODE): $TRIM_BODY"
fi

finish
