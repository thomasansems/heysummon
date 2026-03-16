#!/bin/bash
# HeySummon Claude Code Skill — Ask a human (blocking poll)
#
# Usage:
#   ask.sh "<question>"
#   ask.sh "<question>" "<context>" "<provider-name>"
#
# Returns the human's response on stdout.
# Exits 0 on success, 1 on timeout or error.

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SKILL_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

# Load .env
[ -f "$SKILL_DIR/.env" ] && set -a && source "$SKILL_DIR/.env" && set +a

BASE_URL="${HEYSUMMON_BASE_URL:-http://localhost:3425}"
API_KEY="${HEYSUMMON_API_KEY:-}"
TIMEOUT="${HEYSUMMON_TIMEOUT:-300}"
POLL_INTERVAL="${HEYSUMMON_POLL_INTERVAL:-3}"

QUESTION="$1"
CONTEXT="${2:-}"
PROVIDER_NAME="${3:-}"

if [ -z "$QUESTION" ]; then
  echo "❌ Usage: ask.sh \"<question>\" [context] [provider-name]" >&2
  exit 1
fi

if [ -z "$API_KEY" ]; then
  echo "❌ HEYSUMMON_API_KEY not set. Run: bash $SCRIPT_DIR/setup.sh" >&2
  exit 1
fi

# Build messages array
if [ -n "$CONTEXT" ]; then
  MESSAGES="$CONTEXT"
else
  MESSAGES="[]"
fi

# Submit help request
echo "🦞 HeySummon: Submitting request to human..." >&2

PAYLOAD=$(node -e "
const q = process.argv[1];
const msgs = (() => { try { return JSON.parse(process.argv[2]); } catch { return []; } })();
const prov = process.argv[3] || undefined;
const body = { question: q, messages: msgs };
if (prov) body.providerName = prov;
process.stdout.write(JSON.stringify(body));
" "$QUESTION" "$MESSAGES" "$PROVIDER_NAME" 2>/dev/null)

RESPONSE=$(curl -s -X POST \
  -H "Content-Type: application/json" \
  -H "X-API-Key: $API_KEY" \
  -d "$PAYLOAD" \
  "$BASE_URL/api/v1/help")

# Check for unavailable provider
UNAVAILABLE=$(echo "$RESPONSE" | node -e "
const d=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));
if(d.providerUnavailable){
  const next = d.nextAvailableAt ? ' (available at '+new Date(d.nextAvailableAt).toLocaleTimeString()+')' : '';
  process.stdout.write('UNAVAILABLE'+next);
}" 2>/dev/null)

if [ -n "$UNAVAILABLE" ]; then
  echo "⏸️  Provider unavailable$UNAVAILABLE" >&2
  echo "PROVIDER_UNAVAILABLE: No human available right now. Try again later." 
  exit 0
fi

# Extract request ID and ref code
REQUEST_ID=$(echo "$RESPONSE" | node -e "
const d=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));
process.stdout.write(d.id || d.requestId || '');
" 2>/dev/null)

REF_CODE=$(echo "$RESPONSE" | node -e "
const d=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));
process.stdout.write(d.refCode || '');
" 2>/dev/null)

if [ -z "$REQUEST_ID" ]; then
  echo "❌ Failed to submit request: $RESPONSE" >&2
  exit 1
fi

echo "📨 Request submitted [${REF_CODE:-$REQUEST_ID}] — waiting for human response..." >&2
echo "   (timeout: ${TIMEOUT}s, polling every ${POLL_INTERVAL}s)" >&2

# Poll for response
ELAPSED=0
while [ "$ELAPSED" -lt "$TIMEOUT" ]; do
  sleep "$POLL_INTERVAL"
  ELAPSED=$((ELAPSED + POLL_INTERVAL))

  # Poll events endpoint
  EVENTS=$(curl -s \
    -H "X-API-Key: $API_KEY" \
    "$BASE_URL/api/v1/events/pending" 2>/dev/null)

  # Look for a response event matching our request
  ANSWER=$(echo "$EVENTS" | node -e "
const data = (() => { try { return JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')); } catch { return null; } })();
if (!data) process.exit(1);
const events = data.events || [];
const targetId = process.argv[1];
const targetRef = process.argv[2];
const match = events.find(e =>
  (e.requestId === targetId || e.refCode === targetRef) &&
  (e.type === 'response' || e.status === 'responded' || e.status === 'resolved')
);
if (match) {
  const answer = match.response || match.message || match.content || match.answer || '';
  process.stdout.write(answer);
  process.exit(0);
}
process.exit(1);
" "$REQUEST_ID" "$REF_CODE" 2>/dev/null)

  if [ $? -eq 0 ] && [ -n "$ANSWER" ]; then
    echo "" >&2
    echo "✅ Human responded [${REF_CODE:-$REQUEST_ID}]" >&2
    echo "$ANSWER"
    exit 0
  fi

  # Also check request status directly
  STATUS_RESP=$(curl -s \
    -H "X-API-Key: $API_KEY" \
    "$BASE_URL/api/v1/help/$REQUEST_ID" 2>/dev/null)

  DIRECT_ANSWER=$(echo "$STATUS_RESP" | node -e "
const d = (() => { try { return JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')); } catch { return null; } })();
if (!d) process.exit(1);
if (d.status === 'responded' || d.status === 'resolved') {
  const ans = d.response || d.lastMessage || d.answer || '';
  if (ans) { process.stdout.write(ans); process.exit(0); }
}
process.exit(1);
" 2>/dev/null)

  if [ $? -eq 0 ] && [ -n "$DIRECT_ANSWER" ]; then
    echo "" >&2
    echo "✅ Human responded [${REF_CODE:-$REQUEST_ID}]" >&2
    echo "$DIRECT_ANSWER"
    exit 0
  fi

  # Progress indicator
  if [ $((ELAPSED % 30)) -eq 0 ]; then
    echo "   Still waiting... (${ELAPSED}s elapsed)" >&2
  fi
done

echo "" >&2
echo "⏰ Timeout after ${TIMEOUT}s — no response received." >&2
echo "   Request ref: ${REF_CODE:-$REQUEST_ID}" >&2
echo "   You can check status later: bash $SCRIPT_DIR/check-status.sh ${REF_CODE:-$REQUEST_ID}" >&2
exit 1
