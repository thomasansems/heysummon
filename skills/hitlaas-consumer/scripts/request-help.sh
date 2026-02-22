#!/bin/bash
# Usage: request-help.sh <question> [messages-json-file]
# Sends a help request to the HeySummon platform.
#
# Flow:
#   1. If HEYSUMMON_GUARD_URL is set, validates content through guard first
#   2. Submits request to platform with guard signature (if guard was used)
#
# Required env vars:
#   HEYSUMMON_API_KEY    — your API key (hs_cli_...)
#   HEYSUMMON_API_URL    — platform base URL (e.g. http://localhost:3456)
#
# Optional env vars:
#   HEYSUMMON_GUARD_URL      — guard service URL (e.g. http://localhost:3457)
#   HEYSUMMON_DEVICE_TOKEN   — device attestation token (hs_dev_...)

set -e

QUESTION="${1:-}"
MESSAGES_FILE="${2:-}"

if [ -z "$QUESTION" ]; then
  echo "Usage: request-help.sh <question> [messages-json-file]"
  echo ""
  echo "  question           The question to ask the human expert"
  echo "  messages-json-file Optional JSON file with conversation messages array"
  echo ""
  echo "Required env vars: HEYSUMMON_API_KEY, HEYSUMMON_API_URL"
  exit 1
fi

if [ -z "${HEYSUMMON_API_KEY:-}" ]; then
  echo "Error: HEYSUMMON_API_KEY env var is required"
  exit 1
fi

API_URL="${HEYSUMMON_API_URL:-http://localhost:3456}"

if [ -n "$MESSAGES_FILE" ] && [ -f "$MESSAGES_FILE" ]; then
  MESSAGES=$(cat "$MESSAGES_FILE")
else
  MESSAGES='[{"role":"user","content":"(no context provided)"}]'
fi

# ─── Step 1: Guard pre-flight validation (optional) ───
GUARD_SIGNATURE=""
GUARD_TIMESTAMP=""
GUARD_NONCE=""

if [ -n "${HEYSUMMON_GUARD_URL:-}" ]; then
  echo "Validating content through guard..."
  GUARD_RESPONSE=$(curl -sf -X POST "${HEYSUMMON_GUARD_URL}/validate" \
    -H "Content-Type: application/json" \
    -d "$(jq -n --arg text "$QUESTION" '{text: $text}')")

  VALID=$(echo "$GUARD_RESPONSE" | jq -r '.valid')
  if [ "$VALID" != "true" ]; then
    echo "❌ Content blocked by guard:"
    echo "$GUARD_RESPONSE" | jq .
    exit 1
  fi

  GUARD_SIGNATURE=$(echo "$GUARD_RESPONSE" | jq -r '.signature')
  GUARD_TIMESTAMP=$(echo "$GUARD_RESPONSE" | jq -r '.timestamp')
  GUARD_NONCE=$(echo "$GUARD_RESPONSE" | jq -r '.nonce')
  
  # Use sanitized text from guard
  QUESTION=$(echo "$GUARD_RESPONSE" | jq -r '.sanitizedText')
  
  FLAGS=$(echo "$GUARD_RESPONSE" | jq -r '.flags | length')
  if [ "$FLAGS" -gt 0 ]; then
    echo "⚠️  Guard flags:"
    echo "$GUARD_RESPONSE" | jq '.flags'
  fi
  echo "✅ Guard validation passed"
fi

# ─── Step 2: Submit to platform ───
PAYLOAD=$(jq -n \
  --arg apiKey "$HEYSUMMON_API_KEY" \
  --arg question "$QUESTION" \
  --argjson messages "$MESSAGES" \
  --arg sig "$GUARD_SIGNATURE" \
  --arg ts "$GUARD_TIMESTAMP" \
  --arg nonce "$GUARD_NONCE" \
  '{
    apiKey: $apiKey,
    question: $question,
    messages: $messages,
    signPublicKey: "placeholder",
    encryptPublicKey: "placeholder"
  } + (if $sig != "" then {
    guardSignature: $sig,
    guardTimestamp: ($ts | tonumber),
    guardNonce: $nonce
  } else {} end)')

# Build headers
HEADERS=(-H "Content-Type: application/json" -H "x-api-key: ${HEYSUMMON_API_KEY}")

if [ -n "${HEYSUMMON_DEVICE_TOKEN:-}" ]; then
  HEADERS+=(-H "x-device-token: ${HEYSUMMON_DEVICE_TOKEN}")
fi

# Machine fingerprint
MACHINE_ID=$(echo -n "$(hostname)$(uname -s)$(uname -m)$(whoami)" | sha256sum | cut -d' ' -f1)
HEADERS+=(-H "x-machine-id: ${MACHINE_ID}")

curl -sf -X POST "${API_URL}/api/v1/help" \
  "${HEADERS[@]}" \
  -d "$PAYLOAD" | jq .
