#!/bin/bash
# HeySummon NPX Full-Circle Test
#
# Validates the NPX installer end-to-end:
#   1. Build CLI from source
#   2. Run init --yes (downloads release, installs, builds, starts daemon)
#   3. Wait for health at port 3435
#   4. Verify API responses
#   5. Test tunnel status/detection (cloudflared start/stop if available)
#   6. CLI lifecycle: status -> stop -> start -> status
#   7. Cleanup
#
# Usage:
#   bash e2e/npx-full-circle.sh
#
# Optional env:
#   NPX_PORT          Override default port (default: 3435)
#   SKIP_TUNNEL_TESTS Set to 1 to skip cloudflared tests
#   SKIP_CLEANUP      Set to 1 to keep the daemon running after tests

set -uo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
DIM='\033[2m'
NC='\033[0m'

PORT="${NPX_PORT:-3435}"
BASE_URL="http://localhost:${PORT}"
CLI="node $(pwd)/cli/bin/cli.js"
PASS=0
FAIL=0
TOTAL=0

# ── Helpers ──────────────────────────────────────────────────────────────

pass() {
  PASS=$((PASS + 1))
  TOTAL=$((TOTAL + 1))
  echo -e "  ${GREEN}PASS${NC} $1"
}

fail() {
  FAIL=$((FAIL + 1))
  TOTAL=$((TOTAL + 1))
  echo -e "  ${RED}FAIL${NC} $1"
  if [ -n "${2:-}" ]; then
    echo -e "       ${DIM}$2${NC}"
  fi
}

section() {
  echo ""
  echo -e "${CYAN}--- $1 ---${NC}"
}

wait_for_health() {
  local max_attempts="${1:-60}"
  local url="${BASE_URL}/api/v1/health"
  echo -e "  ${DIM}Waiting for ${url} (up to ${max_attempts} attempts)...${NC}"
  for i in $(seq 1 "$max_attempts"); do
    if curl -sf "$url" > /dev/null 2>&1; then
      echo -e "  ${DIM}Healthy after attempt $i${NC}"
      return 0
    fi
    sleep 2
  done
  echo -e "  ${RED}Health check failed after ${max_attempts} attempts${NC}"
  return 1
}

wait_for_down() {
  local max_attempts="${1:-15}"
  echo -e "  ${DIM}Waiting for server to stop (up to ${max_attempts} attempts)...${NC}"
  for i in $(seq 1 "$max_attempts"); do
    if ! curl -sf "${BASE_URL}/api/v1/health" > /dev/null 2>&1; then
      echo -e "  ${DIM}Server stopped after attempt $i${NC}"
      return 0
    fi
    sleep 1
  done
  echo -e "  ${RED}Server still running after ${max_attempts} attempts${NC}"
  return 1
}

cleanup() {
  if [ "${SKIP_CLEANUP:-0}" = "1" ]; then
    echo -e "\n${YELLOW}Skipping cleanup (SKIP_CLEANUP=1)${NC}"
    return
  fi
  section "Cleanup"
  $CLI stop 2>/dev/null || true
  echo -e "  ${DIM}Daemon stopped${NC}"
}

# ── Main ─────────────────────────────────────────────────────────────────

echo ""
echo "======================================================"
echo "  HeySummon NPX Full-Circle Test"
echo "======================================================"
echo ""
echo -e "${CYAN}Port:${NC}     ${PORT}"
echo -e "${CYAN}CLI:${NC}      ${CLI}"
echo ""

# ── 1. Build CLI from source ────────────────────────────────────────────

section "1. Build CLI from source"

if [ ! -f "cli/package.json" ]; then
  fail "cli/package.json not found (run from repo root)"
  exit 1
fi

cd cli
npm install --silent 2>/dev/null
npm run build --silent 2>/dev/null
cd ..

if [ -f "cli/dist/index.js" ]; then
  pass "CLI built successfully"
else
  fail "CLI build failed (cli/dist/index.js missing)"
  exit 1
fi

# ── 2. Run init --yes ───────────────────────────────────────────────────

section "2. NPX init --yes"

# Run init (downloads release, installs deps, migrates, builds, starts daemon)
$CLI --yes 2>&1 | tail -20

if wait_for_health 90; then
  pass "Server is healthy at ${BASE_URL}"
else
  fail "Server did not become healthy"
  cleanup
  exit 1
fi

# ── 3. Verify API ──────────────────────────────────────────────────────

section "3. API verification"

# Health endpoint
HEALTH=$(curl -sf "${BASE_URL}/api/v1/health" 2>/dev/null)
if echo "$HEALTH" | grep -q '"status":"ok"'; then
  pass "GET /api/v1/health returns status ok"
else
  fail "GET /api/v1/health unexpected response" "$HEALTH"
fi

# Check version field exists
if echo "$HEALTH" | grep -q '"version"'; then
  pass "Health response includes version"
else
  fail "Health response missing version field"
fi

# Check content safety field
if echo "$HEALTH" | grep -q '"contentSafety"'; then
  pass "Health response includes contentSafety"
else
  fail "Health response missing contentSafety field"
fi

# Signup page should be accessible (returns HTML)
SIGNUP_STATUS=$(curl -sf -o /dev/null -w "%{http_code}" "${BASE_URL}/auth/signup" 2>/dev/null)
if [ "$SIGNUP_STATUS" = "200" ]; then
  pass "GET /auth/signup returns 200"
else
  fail "GET /auth/signup returned ${SIGNUP_STATUS}"
fi

# API key endpoint without auth should return 401
NOAUTH_STATUS=$(curl -sf -o /dev/null -w "%{http_code}" "${BASE_URL}/api/v1/help" 2>/dev/null)
if [ "$NOAUTH_STATUS" = "401" ] || [ "$NOAUTH_STATUS" = "400" ]; then
  pass "GET /api/v1/help without auth returns ${NOAUTH_STATUS}"
else
  fail "GET /api/v1/help returned ${NOAUTH_STATUS} (expected 401 or 400)"
fi

# ── 4. Tunnel detection ────────────────────────────────────────────────

section "4. Tunnel detection"

# Tailscale detection (should not be available in CI or most envs)
TS_AVAILABLE=$(which tailscale 2>/dev/null && echo "yes" || echo "no")
if [ "$TS_AVAILABLE" = "no" ]; then
  pass "Tailscale correctly detected as unavailable"
else
  echo -e "  ${YELLOW}SKIP${NC} Tailscale is installed - detection test skipped"
fi

# Cloudflared tests
if [ "${SKIP_TUNNEL_TESTS:-0}" = "1" ]; then
  echo -e "  ${YELLOW}SKIP${NC} Tunnel tests skipped (SKIP_TUNNEL_TESTS=1)"
elif which cloudflared > /dev/null 2>&1; then
  pass "cloudflared binary detected"

  # We can't test the admin tunnel APIs without authentication,
  # but we can verify the cloudflared binary works
  CF_VERSION=$(cloudflared --version 2>&1 || true)
  if echo "$CF_VERSION" | grep -qi "cloudflared"; then
    pass "cloudflared --version responds"
  else
    fail "cloudflared --version unexpected output" "$CF_VERSION"
  fi
else
  echo -e "  ${YELLOW}SKIP${NC} cloudflared not installed"
fi

# ── 5. CLI lifecycle: status -> stop -> start -> status ─────────────────

section "5. CLI lifecycle"

# Status while running
STATUS_OUT=$($CLI status 2>&1)
if echo "$STATUS_OUT" | grep -qi "running"; then
  pass "CLI status shows Running"
else
  fail "CLI status did not show Running" "$STATUS_OUT"
fi

# Stop
$CLI stop 2>&1
if wait_for_down 15; then
  pass "CLI stop: server stopped"
else
  fail "CLI stop: server still running"
fi

# Status while stopped
STATUS_OUT=$($CLI status 2>&1)
if echo "$STATUS_OUT" | grep -qi "stopped\|not running"; then
  pass "CLI status shows Stopped"
else
  fail "CLI status did not show Stopped" "$STATUS_OUT"
fi

# Start daemon
$CLI start -d 2>&1

if wait_for_health 60; then
  pass "CLI start -d: server restarted and healthy"
else
  fail "CLI start -d: server did not become healthy"
fi

# Final status check
STATUS_OUT=$($CLI status 2>&1)
if echo "$STATUS_OUT" | grep -qi "running"; then
  pass "CLI status shows Running after restart"
else
  fail "CLI status did not show Running after restart" "$STATUS_OUT"
fi

# ── Results ─────────────────────────────────────────────────────────────

cleanup

echo ""
echo "======================================================"
if [ "$FAIL" -eq 0 ]; then
  echo -e "  ${GREEN}ALL ${TOTAL} TESTS PASSED${NC}"
else
  echo -e "  ${RED}${FAIL} of ${TOTAL} TESTS FAILED${NC}"
fi
echo "======================================================"
echo ""

[ "$FAIL" -eq 0 ]
