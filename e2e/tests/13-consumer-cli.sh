#!/bin/bash
# HeySummon E2E -- 13: Consumer CLI submit-and-poll
# Tests the SDK CLI blocking poll flow that all skills use
set -uo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../lib.sh"

# Build the SDK CLI path
SDK_CLI="node $PROJECT_DIR/packages/consumer-sdk/dist/cli.js"

# Verify CLI exists
if [ ! -f "$PROJECT_DIR/packages/consumer-sdk/dist/cli.js" ]; then
  skip "Consumer SDK not built (run npm run build first)"
  finish
  exit 0
fi

# -- Test 1: submit-and-poll receives expert response --
section "Consumer CLI: submit-and-poll"

QUESTION="CLI E2E test $(date +%s): Confirm receipt"
ANSWER="CLI E2E: Confirmed"

# Start a background process that waits 3s then replies as expert
(
  sleep 3
  # Poll for the new request
  EVENTS=$(curl -s -H "x-api-key: ${EXPERT_KEY}" "${E2E_BYPASS_ARGS[@]}" "${PENDING_URL}")
  REQ_ID=$(echo "$EVENTS" | jq -r '.events[-1].requestId // empty')
  if [ -n "$REQ_ID" ]; then
    curl -s -X POST "${BASE_URL}/api/v1/message/${REQ_ID}" \
      -H "x-api-key: ${EXPERT_KEY}" \
      -H "Content-Type: application/json" \
      "${E2E_BYPASS_ARGS[@]}" \
      -d "$(jq -n --arg p "$ANSWER" '{from: "expert", plaintext: $p}')" >/dev/null
  fi
) &
PIDS+=($!)

# Run submit-and-poll with short timeout
export HEYSUMMON_BASE_URL="$BASE_URL"
export HEYSUMMON_API_KEY="$CLIENT_KEY"
export HEYSUMMON_TIMEOUT=15
export HEYSUMMON_POLL_INTERVAL=2

OUTPUT=$($SDK_CLI submit-and-poll --question "$QUESTION" 2>/dev/null)
EXIT_CODE=$?

# Verify response received
if echo "$OUTPUT" | grep -q "Confirmed"; then
  pass "submit-and-poll received expert response"
else
  fail "submit-and-poll did not receive response: $OUTPUT"
fi
[ "$EXIT_CODE" -eq 0 ] && pass "Exit code is 0" || fail "Exit code: $EXIT_CODE"

# ── Test 2: timeout behavior ──
section "Consumer CLI: timeout"
export HEYSUMMON_TIMEOUT=5
export HEYSUMMON_POLL_INTERVAL=1

TIMEOUT_OUTPUT=$($SDK_CLI submit-and-poll --question "Timeout test $(date +%s)" 2>/dev/null)
if echo "$TIMEOUT_OUTPUT" | grep -q "TIMEOUT"; then
  pass "submit-and-poll returns TIMEOUT signal on expiry"
else
  fail "Expected TIMEOUT signal, got: $TIMEOUT_OUTPUT"
fi

# ── Test 3: invalid API key ──
section "Consumer CLI: invalid key"
export HEYSUMMON_API_KEY="hs_cli_invalid_key_e2e"
UNAVAIL_OUTPUT=$($SDK_CLI submit-and-poll --question "Unavail test" 2>/dev/null)
UNAVAIL_EXIT=$?
[ "$UNAVAIL_EXIT" -ne 0 ] && pass "Invalid key returns non-zero exit" || fail "Invalid key should fail (exit: $UNAVAIL_EXIT)"

finish
