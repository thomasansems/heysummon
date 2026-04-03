#!/bin/bash
# HeySummon Expert — Reply to a help request by refCode
# Usage: reply-handler.sh <refCode> "<response text>"
#
# Looks up the request by refCode, then sends a plaintext response via the platform API.
# All encryption/security is handled server-side by the platform.

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SKILL_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
[ -f "$SKILL_DIR/.env" ] && set -a && source "$SKILL_DIR/.env" && set +a

BASE_URL="${HEYSUMMON_BASE_URL:?ERROR: Set HEYSUMMON_BASE_URL in .env}"
API_KEY="${HEYSUMMON_API_KEY:?ERROR: Set HEYSUMMON_API_KEY in .env}"

REF_CODE="$1"
RESPONSE="$2"

if [ -z "$REF_CODE" ] || [ -z "$RESPONSE" ]; then
  echo "Usage: reply-handler.sh <refCode> \"<response text>\"" >&2
  exit 1
fi

# Validate expert key prefix
if [[ ! "$API_KEY" =~ ^hs_exp_ ]]; then
  echo "HEYSUMMON_API_KEY must be an expert key (hs_exp_...)" >&2
  exit 1
fi

# Look up request by refCode
REQUEST=$(curl -s "${BASE_URL}/api/v1/requests/by-ref/${REF_CODE}" \
  -H "x-api-key: ${API_KEY}")

REQUEST_ID=$(echo "$REQUEST" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{try{const j=JSON.parse(d);console.log(j.requestId||j.id||'')}catch(e){console.log('')}})" 2>/dev/null)

if [ -z "$REQUEST_ID" ]; then
  echo "Request $REF_CODE not found" >&2
  exit 1
fi

# Detect approve/deny — send as approvalDecision via message endpoint
LOWER_RESPONSE=$(echo "$RESPONSE" | tr '[:upper:]' '[:lower:]' | tr -d '[:space:]')

if [ "$LOWER_RESPONSE" = "approved" ] || [ "$LOWER_RESPONSE" = "approve" ]; then
  PAYLOAD=$(node -e "console.log(JSON.stringify({plaintext:'approved',from:'expert',approvalDecision:'approved'}))" 2>/dev/null)
  DISPLAY="Approved"
elif [ "$LOWER_RESPONSE" = "denied" ] || [ "$LOWER_RESPONSE" = "deny" ]; then
  PAYLOAD=$(node -e "console.log(JSON.stringify({plaintext:'denied',from:'expert',approvalDecision:'denied'}))" 2>/dev/null)
  DISPLAY="Denied"
else
  # Regular plaintext response
  PAYLOAD=$(node -e "console.log(JSON.stringify({plaintext:process.argv[1],from:'expert'}))" "$RESPONSE" 2>/dev/null)
  DISPLAY="Response sent for $REF_CODE"
fi

RESULT=$(curl -s -X POST "${BASE_URL}/api/v1/message/${REQUEST_ID}" \
  -H "Content-Type: application/json" \
  -H "x-api-key: ${API_KEY}" \
  -d "$PAYLOAD")

ERROR=$(echo "$RESULT" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{try{const j=JSON.parse(d);if(j.error)console.log(j.error)}catch(e){}})" 2>/dev/null)

if [ -n "$ERROR" ]; then
  echo "Failed: $ERROR" >&2
  exit 1
fi

echo "$DISPLAY"
