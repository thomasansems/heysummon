#!/bin/bash
# HeySummon E2E — 11: MCP Server Flow
# Simulates Claude Code using the MCP server to request human help:
#   1. MCP server submits help request (with auto-generated crypto keys)
#   2. Provider receives SSE notification
#   3. Provider replies
#   4. MCP server polls and gets the response
set -uo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../lib.sh"

echo ""
echo "══════════════════════════════════════════"
echo "  🤖 11 — MCP Server Flow"
echo "══════════════════════════════════════════"

MCP_SERVER="${MCP_SERVER_PATH:-$(cd "$SCRIPT_DIR/../../skills/claudecode/mcp-server" && pwd)/index.js}"

# ── 1. Generate crypto keys (same as MCP server does) ──
section "Generate session crypto keys"
KEYS_JSON=$(generate_crypto_keys)
SIGN_PUB=$(echo "$KEYS_JSON" | jq -r '.signPublicKey')
ENC_PUB=$(echo "$KEYS_JSON" | jq -r '.encryptPublicKey')

if [ -n "$SIGN_PUB" ] && [ -n "$ENC_PUB" ]; then
  pass "Generated Ed25519 (sign) + X25519 (encrypt) key pair"
else
  fail "Key generation failed"
  exit 1
fi

# ── 2. Submit help request (simulating MCP server) ──
section "Submit help request via MCP-style call"
QUESTION="MCP E2E $(date +%s): What is the best way to handle async errors in TypeScript?"

# Start provider SSE listener BEFORE submitting
info "Starting provider SSE listener..."
curl -sN \
  -H "x-api-key: ${PROVIDER_KEY}" \
  "${E2E_BASE_URL}/api/v1/events/stream" \
  > "$TMPDIR/mcp-provider-events.raw" 2>/dev/null &
PIDS+=($!)
sleep 2

SUBMIT_RESPONSE=$(curl -s -X POST "${BASE_URL}/api/v1/help" \
  -H "Content-Type: application/json" \
  "${E2E_BYPASS_ARGS[@]+"${E2E_BYPASS_ARGS[@]}"}" \
  -d "$(jq -n \
    --arg apiKey "$CLIENT_KEY" \
    --arg signPublicKey "$SIGN_PUB" \
    --arg encryptPublicKey "$ENC_PUB" \
    --arg question "$QUESTION" \
    '{
      apiKey: $apiKey,
      signPublicKey: $signPublicKey,
      encryptPublicKey: $encryptPublicKey,
      question: $question,
      messages: [{ role: "user", content: $question }]
    }'
  )")

REF_CODE=$(echo "$SUBMIT_RESPONSE" | jq -r '.refCode // empty')
REQUEST_ID=$(echo "$SUBMIT_RESPONSE" | jq -r '.requestId // empty')

if [ -n "$REF_CODE" ] && [ "$REF_CODE" != "null" ]; then
  pass "Help request submitted: $REF_CODE (id: $REQUEST_ID)"
else
  fail "Submit failed: $SUBMIT_RESPONSE"
  exit 1
fi

# ── 3. Provider receives SSE notification ──
section "Provider SSE notification"
RECEIVED=false
for i in $(seq 1 "$TIMEOUT"); do
  if grep -q "$REF_CODE" "$TMPDIR/mcp-provider-events.raw" 2>/dev/null; then
    RECEIVED=true
    break
  fi
  sleep 1
done
[ "$RECEIVED" = true ] && pass "Provider received SSE event for $REF_CODE" || fail "Provider did not receive SSE event within ${TIMEOUT}s"

# ── 4. Provider replies (simulating human answering) ──
section "Provider reply (human response)"
REPLY="Use try/catch with async/await and always type your error as 'unknown', then narrow with instanceof."

REPLY_RESPONSE=$(curl -s -X POST "${BASE_URL}/api/v1/message/${REQUEST_ID}" \
  -H "Content-Type: application/json" \
  -H "x-api-key: ${PROVIDER_KEY}" \
  "${E2E_BYPASS_ARGS[@]+"${E2E_BYPASS_ARGS[@]}"}" \
  -d "$(jq -n --arg content "$REPLY" '{from: "provider", content: $content}')")

if echo "$REPLY_RESPONSE" | jq -e '.message // .id // .ok' > /dev/null 2>&1; then
  pass "Provider reply sent"
else
  fail "Provider reply failed: $REPLY_RESPONSE"
fi

# ── 5. MCP server polls for response ──
section "MCP poll — waiting for provider response"
POLL_GOT_RESPONSE=false
for i in $(seq 1 "$TIMEOUT"); do
  POLL_RESPONSE=$(curl -s "${BASE_URL}/api/v1/requests/${REQUEST_ID}" \
    -H "x-api-key: ${CLIENT_KEY}" \
    "${E2E_BYPASS_ARGS[@]+"${E2E_BYPASS_ARGS[@]}"}")

  STATUS=$(echo "$POLL_RESPONSE" | jq -r '.request.status // empty')

  if [ "$STATUS" = "responded" ] || [ "$STATUS" = "closed" ]; then
    POLL_GOT_RESPONSE=true
    break
  fi
  sleep 1
done

if [ "$POLL_GOT_RESPONSE" = true ]; then
  pass "MCP poll returned status: $STATUS"
else
  fail "MCP poll timed out — status: $STATUS"
fi

# ── 6. Verify response content ──
section "Response content check"
PROVIDER_MSG=$(echo "$POLL_RESPONSE" | jq -r '
  .request.messages
  | map(select(.from == "provider" or .role == "provider"))
  | last
  | .content // .plaintext // .text // empty
')

if [ -n "$PROVIDER_MSG" ]; then
  pass "Got provider message: ${PROVIDER_MSG:0:80}..."
else
  fail "No provider message found in response"
fi

# ── Summary ──
echo ""
finish
