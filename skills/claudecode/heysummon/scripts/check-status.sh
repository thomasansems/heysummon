#!/bin/bash
# HeySummon Claude Code Skill — Check request status
# Usage: check-status.sh <refCode|requestId>

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SKILL_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
[ -f "$SKILL_DIR/.env" ] && set -a && source "$SKILL_DIR/.env" && set +a

BASE_URL="${HEYSUMMON_BASE_URL:-http://localhost:3425}"
API_KEY="${HEYSUMMON_API_KEY:-}"
REF="$1"

if [ -z "$REF" ]; then
  echo "Usage: check-status.sh <refCode|requestId>"
  exit 1
fi

RESP=$(curl -s -H "X-API-Key: $API_KEY" "$BASE_URL/api/v1/help/$REF")
echo "$RESP" | node -e "
const d = JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));
if (d.error) { console.log('❌ Not found:', d.error); process.exit(1); }
const status = d.status || 'unknown';
const icons = { pending:'⏳', responded:'✅', resolved:'✅', expired:'⏰', cancelled:'❌' };
console.log((icons[status]||'•') + ' Status: ' + status);
if (d.refCode) console.log('  Ref: ' + d.refCode);
if (d.response || d.lastMessage) console.log('  Response: ' + (d.response || d.lastMessage));
" 2>/dev/null || echo "$RESP"
