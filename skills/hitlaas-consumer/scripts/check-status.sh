#!/bin/bash
# Usage: check-status.sh <request-id>
# Polls the HITLaaS relay for the current status of a help request.
# No authentication required.
#
# Optional env vars:
#   HITLAAS_RELAY_URL — relay base URL (default: http://localhost:4000)

set -e

REQUEST_ID="${1:-}"

if [ -z "$REQUEST_ID" ]; then
  echo "Usage: check-status.sh <request-id>"
  echo ""
  echo "  request-id   The requestId returned from request-help.sh"
  exit 1
fi

RELAY_URL="${HITLAAS_RELAY_URL:-http://localhost:4000}"

curl -sf "${RELAY_URL}/api/v1/relay/status/${REQUEST_ID}" | jq .
