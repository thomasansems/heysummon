#!/bin/bash
# E2E Test 11: Skill Install URL
# Tests that /api/v1/skill-install/[keyId] returns proper HTTP codes

set -uo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/../lib.sh"

section "Skill Install URL"

# ── Test 1: Non-existent key returns 404 ────────────────────────────────────
section "1.1 - Non-existent key returns 404"
STATUS=$(curl -s -L -o /dev/null -w "%{http_code}" \
  "$BASE_URL/api/v1/skill-install/nonexistent-key-id")
[ "$STATUS" = "404" ] \
  && pass "Non-existent key returns 404" \
  || fail "Expected 404 for invalid key, got $STATUS"

# ── Test 2: Random UUID returns 404 ──────────────────────────────────────
section "1.2 - Random UUID returns 404"
RANDOM_UUID="cmlt1234567890abcdefghij"
STATUS=$(curl -s -L -o /dev/null -w "%{http_code}" \
  "$BASE_URL/api/v1/skill-install/$RANDOM_UUID")
[ "$STATUS" = "404" ] \
  && pass "Random UUID returns 404" \
  || fail "Expected 404 for random UUID, got $STATUS"

# ── Test 3: Invalid format returns 404 ─────────────────────────────────────
section "1.3 - Invalid key format returns 404"
STATUS=$(curl -s -L -o /dev/null -w "%{http_code}" \
  "$BASE_URL/api/v1/skill-install/../../../etc/passwd")
[ "$STATUS" = "404" ] \
  && pass "Path traversal attempt returns 404" \
  || fail "Expected 404 for path traversal, got $STATUS"

# ── Test 4: Empty key returns 404 ─────────────────────────────────────────
section "1.4 - Empty key returns 404"
STATUS=$(curl -s -L -o /dev/null -w "%{http_code}" \
  "$BASE_URL/api/v1/skill-install/")
[ "$STATUS" = "404" ] \
  && pass "Empty key returns 404" \
  || fail "Expected 404 for empty key, got $STATUS"

# ── Test 5: Service healthy (endpoint exists) ───────────────────────────────
section "1.5 - Service is healthy"
HEALTH=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/api/v1/health")
[ "$HEALTH" = "200" ] \
  && pass "Platform health check OK" \
  || fail "Platform should be healthy, got $HEALTH"

finish
