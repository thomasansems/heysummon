#!/bin/bash
# HeySummon E2E — 01: Health & connectivity checks
set -uo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../lib.sh"

echo ""
echo "══════════════════════════════════════════"
echo "  🧪 01 — Health & Connectivity"
echo "══════════════════════════════════════════"

# ── Platform health ──
section "Platform Health"
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "${BASE_URL}/api/v1/health" 2>/dev/null || echo "000")
[ "$HTTP_CODE" = "200" ] && pass "Platform healthy (HTTP 200)" || fail "Platform not reachable (HTTP $HTTP_CODE)"

# ── Guard health ──
section "Guard Health"
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "${GUARD_URL}/health" 2>/dev/null || echo "000")
if [ "$HTTP_CODE" = "200" ]; then
  pass "Guard healthy (HTTP 200)"
else
  skip "Guard not available (HTTP $HTTP_CODE)"
fi

# ── Requests API requires auth ──
section "Requests API Auth"
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "${BASE_URL}/api/v1/requests" 2>/dev/null || echo "000")
[ "$HTTP_CODE" = "401" ] && pass "Requests API requires auth (401)" || fail "Requests API auth check unexpected (HTTP $HTTP_CODE)"

# ── Whoami ──
section "Whoami"
WHOAMI=$(curl -s "${BASE_URL}/api/v1/whoami" -H "x-api-key: ${CLIENT_KEY}")
PROV_NAME=$(echo "$WHOAMI" | jq -r '.provider.name // empty' 2>/dev/null)
[ -n "$PROV_NAME" ] && pass "Whoami: provider='$PROV_NAME'" || fail "Whoami failed: $WHOAMI"

finish
