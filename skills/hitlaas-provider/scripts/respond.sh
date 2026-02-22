#!/bin/bash
# Usage: respond.sh <request-id> <response>
# Sends a response to a HITLaaS help request via the relay.
# The relay will deliver the response to the consumer's callbackUrl.
#
# Required env vars:
#   HITLAAS_API_KEY   — your provider API key (htl_...)
#
# Optional env vars:
#   HITLAAS_RELAY_URL — relay base URL (default: http://localhost:4000)

set -e

REQUEST_ID="${1:-}"
RESPONSE_TEXT="${2:-}"

if [ -z "$REQUEST_ID" ] || [ -z "$RESPONSE_TEXT" ]; then
  echo "Usage: respond.sh <request-id> <response>"
  echo ""
  echo "  request-id   The requestId of the help request"
  echo "  response     Your answer to the AI agent's question"
  echo ""
  echo "Required env vars: HITLAAS_API_KEY"
  exit 1
fi

if [ -z "${HITLAAS_API_KEY:-}" ]; then
  echo "Error: HITLAAS_API_KEY env var is required"
  exit 1
fi

RELAY_URL="${HITLAAS_RELAY_URL:-http://localhost:4000}"

PAYLOAD=$(jq -n --arg response "$RESPONSE_TEXT" '{ response: $response }')

DEVICE_TOKEN_HEADER=""
if [ -n "${HEYSUMMON_DEVICE_TOKEN:-}" ]; then
  DEVICE_TOKEN_HEADER="-H x-device-token: ${HEYSUMMON_DEVICE_TOKEN}"
fi

# Machine fingerprint (hardware-bound, computed at runtime)
MACHINE_ID=$(echo -n "$(hostname)$(uname -s)$(uname -m)$(whoami)" | sha256sum | cut -d' ' -f1)

curl -sf -X POST "${RELAY_URL}/api/v1/relay/respond/${REQUEST_ID}" \
  -H "Content-Type: application/json" \
  -H "x-api-key: ${HITLAAS_API_KEY}" \
  -H "x-machine-id: ${MACHINE_ID}" \
  ${DEVICE_TOKEN_HEADER:+$DEVICE_TOKEN_HEADER} \
  -d "$PAYLOAD" | jq .
