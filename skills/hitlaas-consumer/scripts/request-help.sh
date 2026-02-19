#!/bin/bash
# Usage: request-help.sh <api-key> <question> [messages-json-file]
# Sends a help request to HITLaaS and prints the request ID and ref code.

set -e

API_KEY="${1:-}"
QUESTION="${2:-}"
MESSAGES_FILE="${3:-}"

if [ -z "$API_KEY" ] || [ -z "$QUESTION" ]; then
  echo "Usage: request-help.sh <api-key> <question> [messages-json-file]"
  echo ""
  echo "  api-key           Your HITLaaS API key"
  echo "  question           The question to ask the human expert"
  echo "  messages-json-file Optional JSON file with conversation messages array"
  exit 1
fi

BASE_URL="${HITLAAS_BASE_URL:-https://hitlaas.vercel.app}"

if [ -n "$MESSAGES_FILE" ] && [ -f "$MESSAGES_FILE" ]; then
  MESSAGES=$(cat "$MESSAGES_FILE")
else
  MESSAGES='[{"role":"user","content":"(no context provided)"}]'
fi

PAYLOAD=$(jq -n \
  --arg apiKey "$API_KEY" \
  --arg question "$QUESTION" \
  --argjson messages "$MESSAGES" \
  '{ apiKey: $apiKey, question: $question, messages: $messages }')

RESPONSE=$(curl -s -X POST "${BASE_URL}/api/v1/help" \
  -H "Content-Type: application/json" \
  -d "$PAYLOAD")

echo "$RESPONSE" | jq .
