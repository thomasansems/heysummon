#!/bin/bash
# Usage: request-help.sh <question> [messages-json-file]
# Sends a help request to the HITLaaS relay and prints the requestId and refCode.
#
# Required env vars:
#   HITLAAS_API_KEY      — your API key (htl_...)
#   HITLAAS_CALLBACK_URL — your webhook URL for receiving the response
#
# Optional env vars:
#   HITLAAS_RELAY_URL    — relay base URL (default: http://localhost:4000)

set -e

QUESTION="${1:-}"
MESSAGES_FILE="${2:-}"

if [ -z "$QUESTION" ]; then
  echo "Usage: request-help.sh <question> [messages-json-file]"
  echo ""
  echo "  question           The question to ask the human expert"
  echo "  messages-json-file Optional JSON file with conversation messages array"
  echo ""
  echo "Required env vars: HITLAAS_API_KEY, HITLAAS_CALLBACK_URL"
  exit 1
fi

if [ -z "${HITLAAS_API_KEY:-}" ]; then
  echo "Error: HITLAAS_API_KEY env var is required"
  exit 1
fi

if [ -z "${HITLAAS_CALLBACK_URL:-}" ]; then
  echo "Error: HITLAAS_CALLBACK_URL env var is required"
  exit 1
fi

RELAY_URL="${HITLAAS_RELAY_URL:-http://localhost:4000}"

if [ -n "$MESSAGES_FILE" ] && [ -f "$MESSAGES_FILE" ]; then
  MESSAGES=$(cat "$MESSAGES_FILE")
else
  MESSAGES='[{"role":"user","content":"(no context provided)"}]'
fi

PAYLOAD=$(jq -n \
  --arg question "$QUESTION" \
  --arg callbackUrl "$HITLAAS_CALLBACK_URL" \
  --argjson messages "$MESSAGES" \
  '{ question: $question, callbackUrl: $callbackUrl, messages: $messages }')

DEVICE_TOKEN_HEADER=""
if [ -n "${HEYSUMMON_DEVICE_TOKEN:-}" ]; then
  DEVICE_TOKEN_HEADER="-H x-device-token: ${HEYSUMMON_DEVICE_TOKEN}"
fi

# Machine fingerprint (hardware-bound, computed at runtime)
MACHINE_ID=$(echo -n "$(hostname)$(uname -s)$(uname -m)$(whoami)" | sha256sum | cut -d' ' -f1)

curl -sf -X POST "${RELAY_URL}/api/v1/relay/send" \
  -H "Content-Type: application/json" \
  -H "x-api-key: ${HITLAAS_API_KEY}" \
  -H "x-machine-id: ${MACHINE_ID}" \
  ${DEVICE_TOKEN_HEADER:+$DEVICE_TOKEN_HEADER} \
  -d "$PAYLOAD" | jq .
