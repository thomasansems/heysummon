#!/bin/bash
# Usage: register-webhook.sh <provider-webhook-url>
# Registers this API key's provider webhook URL on the platform (once at startup).
# After this, the relay will push new requests to this URL instead of requiring polling.
#
# Required env vars:
#   HITLAAS_API_KEY    — your provider API key (htl_...)
#
# Optional env vars:
#   HITLAAS_PLATFORM_URL — platform base URL (default: http://localhost:3000)

set -e

WEBHOOK_URL="${1:-}"

if [ -z "$WEBHOOK_URL" ]; then
  echo "Usage: register-webhook.sh <provider-webhook-url>"
  echo ""
  echo "  provider-webhook-url   The HTTPS URL where new requests will be pushed"
  echo "                         e.g. https://your-provider.com/hitlaas/incoming"
  echo ""
  echo "Required env vars: HITLAAS_API_KEY"
  exit 1
fi

if [ -z "${HITLAAS_API_KEY:-}" ]; then
  echo "Error: HITLAAS_API_KEY env var is required"
  exit 1
fi

PLATFORM_URL="${HITLAAS_PLATFORM_URL:-http://localhost:3000}"

RESULT=$(curl -sf -X PATCH "${PLATFORM_URL}/api/keys" \
  -H "Content-Type: application/json" \
  -H "x-api-key: ${HITLAAS_API_KEY}" \
  -d "{\"providerWebhookUrl\": \"${WEBHOOK_URL}\"}")

echo "$RESULT" | jq .
echo ""
echo "✅ Provider webhook registered. The relay will push new requests to: ${WEBHOOK_URL}"
