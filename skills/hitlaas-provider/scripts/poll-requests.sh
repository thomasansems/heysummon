#!/bin/bash
# Usage: poll-requests.sh
# Polls for pending HITLaaS help requests (requires authenticated session).
# Note: This endpoint requires browser session auth. For API-based access, use the provider API key.

set -e

BASE_URL="${HITLAAS_BASE_URL:-https://hitlaas.vercel.app}"
COOKIE="${HITLAAS_SESSION_COOKIE:-}"

if [ -z "$COOKIE" ]; then
  echo "Warning: No HITLAAS_SESSION_COOKIE set. Request may fail without authentication."
fi

curl -s "${BASE_URL}/api/requests" \
  -H "Cookie: ${COOKIE}" | jq .
