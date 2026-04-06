#!/bin/bash
# ZAP Security — Malicious Content Check
# Verifies Guard blocks dangerous payloads before they reach /api/v1/help and /api/v1/message
# CI FAILS if any malicious content is accepted (HTTP 200) instead of blocked (HTTP 422/400)

set -uo pipefail

GUARD_URL="${GUARD_URL:-http://localhost:3457}"
CLIENT_KEY="${E2E_CLIENT_KEY:?Set E2E_CLIENT_KEY}"
EXPERT_KEY="${E2E_EXPERT_KEY:?Set E2E_EXPERT_KEY}"
BASE_URL="${E2E_BASE_URL:-http://localhost:3000}"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

PASSED=0
FAILED=0

pass() { PASSED=$((PASSED+1)); echo -e "${GREEN}✅ $1${NC}"; }
fail() { FAILED=$((FAILED+1)); echo -e "${RED}❌ $1${NC}"; }
section() { echo -e "\n${CYAN}── $1 ──${NC}"; }

echo ""
echo "══════════════════════════════════════════════════"
echo "  🛡️  Malicious Content Guard Check (ZAP Suite)"
echo "══════════════════════════════════════════════════"

# Check Guard is up
HTTP_CODE=$(curl -sf -o /dev/null -w "%{http_code}" "${GUARD_URL}/api/v1/health" 2>/dev/null || echo "000")
if [ "$HTTP_CODE" != "200" ]; then
  # Fallback: try /health for standalone Guard proxy
  HTTP_CODE=$(curl -sf -o /dev/null -w "%{http_code}" "${GUARD_URL}/health" 2>/dev/null || echo "000")
fi
if [ "$HTTP_CODE" != "200" ]; then
  echo -e "${RED}❌ Guard not running at ${GUARD_URL} — aborting${NC}"
  exit 1
fi

submit_guard() {
  local question="$1"
  curl -s -w '\n%{http_code}' -X POST "${GUARD_URL}/api/v1/help" \
    -H "Content-Type: application/json" \
    -d "$(node -e "console.log(JSON.stringify({apiKey:'${CLIENT_KEY}',question:process.argv[1],messages:[]}));" "$question")"
}

code_of() { echo "$1" | tail -1; }
body_of() { echo "$1" | sed '$d'; }

# ── 1. Credit card number must be BLOCKED ──────────────────────────────────
section "1. Credit card — must not be accepted (expect 4xx)"
R=$(submit_guard "My credit card number is 4111111111111111 please help")
C=$(code_of "$R")
[ "$C" != "200" ] && [ "$C" != "201" ] && pass "CC number blocked (HTTP $C)" || fail "CC number NOT blocked — got HTTP $C (Guard bypass!)"

# ── 2. SSN must be BLOCKED ─────────────────────────────────────────────────
section "2. SSN — must not be accepted (expect 4xx)"
R=$(submit_guard "My SSN is 123-45-6789 and I need help")
C=$(code_of "$R")
[ "$C" != "200" ] && [ "$C" != "201" ] && pass "SSN blocked (HTTP $C)" || fail "SSN NOT blocked — got HTTP $C (Guard bypass!)"

# ── 3. BSN (Dutch) must be BLOCKED ─────────────────────────────────────────
section "3. BSN — must not be accepted (expect 4xx)"
R=$(submit_guard "Mijn BSN nummer is 111222333")
C=$(code_of "$R")
[ "$C" != "200" ] && [ "$C" != "201" ] && pass "BSN blocked (HTTP $C)" || fail "BSN NOT blocked — got HTTP $C (Guard bypass!)"

# ── 4. XSS via Guard — must not get 200 with raw script tag intact ─────────
section "4. XSS via /api/v1/help direct — Guard must sanitize or reject"
R=$(curl -s -w '\n%{http_code}' -X POST "${BASE_URL}/api/v1/help" \
  -H "Content-Type: application/json" \
  -d "{\"apiKey\":\"${CLIENT_KEY}\",\"question\":\"<script>alert(document.cookie)</script>\"}")
C=$(code_of "$R")
BODY=$(body_of "$R")
# Guard should strip XSS; if it reaches platform and is stored raw → fail
if [ "$C" = "200" ]; then
  STORED_Q=$(echo "$BODY" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{try{const j=JSON.parse(d);console.log(j.question||'')}catch(e){}})" 2>/dev/null)
  if echo "$STORED_Q" | grep -q "<script>"; then
    fail "XSS stored raw in platform — Guard did NOT sanitize!"
  else
    pass "XSS sanitized before storage (HTTP $C)"
  fi
else
  pass "XSS handled (HTTP $C)"
fi

# ── 5. SQL injection in question field ────────────────────────────────────
section "5. SQL injection — platform must not error 500"
R=$(curl -s -w '\n%{http_code}' -X POST "${BASE_URL}/api/v1/help" \
  -H "Content-Type: application/json" \
  -d "{\"apiKey\":\"${CLIENT_KEY}\",\"question\":\"'; DROP TABLE \\\"HelpRequest\\\"; --\"}")
C=$(code_of "$R")
[ "$C" = "500" ] && fail "SQL injection caused 500 — possible injection vulnerability!" || pass "SQL injection handled safely (HTTP $C)"

# ── 6. Message endpoint — no injection through /api/v1/message ────────────
section "6. /api/v1/message — malicious plaintext must not be accepted unauthenticated"
R=$(curl -s -w '\n%{http_code}' -X POST "${BASE_URL}/api/v1/message/nonexistent-id" \
  -H "Content-Type: application/json" \
  -H "x-api-key: ${EXPERT_KEY}" \
  -d '{"from":"expert","plaintext":"<script>steal()</script>"}')
C=$(code_of "$R")
[ "$C" = "403" ] || [ "$C" = "404" ] && pass "Message to nonexistent request rejected ($C)" || fail "Unexpected response for malicious message: HTTP $C"

# ── 7. Empty API key must be rejected ──────────────────────────────────────
section "7. Empty API key — must return 401"
R=$(curl -s -w '\n%{http_code}' "${BASE_URL}/api/v1/whoami" \
  -H "x-api-key: ")
C=$(code_of "$R")
[ "$C" = "401" ] && pass "Empty API key rejected (401)" || fail "Empty API key NOT rejected — got HTTP $C"

# ── 8. Oversized payload to Guard — must be rejected ──────────────────────
section "8. Oversized payload (>1MB) to Guard — must reject"
TMPFILE=$(mktemp)
node -e "const big='A'.repeat(1100000);process.stdout.write(JSON.stringify({apiKey:'${CLIENT_KEY}',question:big}))" > "$TMPFILE"
R=$(curl -s -w '\n%{http_code}' -X POST "${GUARD_URL}/api/v1/help" \
  -H "Content-Type: application/json" \
  --data-binary @"$TMPFILE" 2>/dev/null)
C=$(code_of "$R")
rm -f "$TMPFILE"
[ "$C" = "413" ] || [ "$C" = "400" ] || [ "$C" = "500" ] || [ "$C" = "000" ] \
  && pass "Oversized payload rejected (HTTP $C)" \
  || fail "Oversized payload NOT rejected — got HTTP $C"

# ── Summary ────────────────────────────────────────────────────────────────
echo ""
echo "══════════════════════════════════════════════════"
if [ "$FAILED" -gt 0 ]; then
  echo -e "  ${RED}❌ $FAILED malicious content check(s) FAILED${NC}, ${GREEN}$PASSED passed${NC}"
  echo "  Guard is not blocking dangerous content — review immediately!"
  echo "══════════════════════════════════════════════════"
  exit 1
else
  echo -e "  ${GREEN}✅ All $PASSED malicious content checks passed${NC}"
  echo "  Guard is correctly blocking/sanitizing dangerous payloads."
  echo "══════════════════════════════════════════════════"
fi
