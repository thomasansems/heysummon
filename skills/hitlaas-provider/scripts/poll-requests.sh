#!/bin/bash
# Usage: poll-requests.sh
# Lists pending HITLaaS help requests from the relay.
#
# Required env vars:
#   HITLAAS_API_KEY   — your provider API key (htl_...)
#
# Optional env vars:
#   HITLAAS_RELAY_URL — relay base URL (default: http://localhost:4000)

set -e

if [ -z "${HITLAAS_API_KEY:-}" ]; then
  echo "Error: HITLAAS_API_KEY env var is required"
  exit 1
fi

RELAY_URL="${HITLAAS_RELAY_URL:-http://localhost:4000}"

DEVICE_TOKEN_HEADER=""
if [ -n "${HEYSUMMON_DEVICE_TOKEN:-}" ]; then
  DEVICE_TOKEN_HEADER="-H x-device-token: ${HEYSUMMON_DEVICE_TOKEN}"
fi

curl -sf "${RELAY_URL}/api/v1/relay/pending" \
  -H "x-api-key: ${HITLAAS_API_KEY}" \
  ${DEVICE_TOKEN_HEADER:+$DEVICE_TOKEN_HEADER} | jq .
