#!/bin/bash
# Usage: check-status.sh <request-id>
# Polls a HITLaaS help request and prints its current status.

set -e

REQUEST_ID="${1:-}"

if [ -z "$REQUEST_ID" ]; then
  echo "Usage: check-status.sh <request-id>"
  echo ""
  echo "  request-id   The ID returned from request-help.sh"
  exit 1
fi

BASE_URL="${HITLAAS_BASE_URL:-https://hitlaas.vercel.app}"

RESPONSE=$(curl -s "${BASE_URL}/api/v1/help/${REQUEST_ID}")

echo "$RESPONSE" | jq .
