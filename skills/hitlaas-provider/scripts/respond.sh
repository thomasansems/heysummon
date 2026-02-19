#!/bin/bash
# Usage: respond.sh <request-id> <response>
# Sends a response to a HITLaaS help request.

set -e

REQUEST_ID="${1:-}"
RESPONSE_TEXT="${2:-}"

if [ -z "$REQUEST_ID" ] || [ -z "$RESPONSE_TEXT" ]; then
  echo "Usage: respond.sh <request-id> <response>"
  echo ""
  echo "  request-id   The help request ID"
  echo "  response     Your answer to the AI agent's question"
  exit 1
fi

BASE_URL="${HITLAAS_BASE_URL:-https://hitlaas.vercel.app}"
COOKIE="${HITLAAS_SESSION_COOKIE:-}"

PAYLOAD=$(jq -n --arg response "$RESPONSE_TEXT" '{ response: $response }')

curl -s -X PATCH "${BASE_URL}/api/requests/${REQUEST_ID}" \
  -H "Content-Type: application/json" \
  -H "Cookie: ${COOKIE}" \
  -d "$PAYLOAD" | jq .
