#!/bin/bash
# E2E Test 11: Skill Install URL
# Tests that /api/v1/skill-install/[keyId] returns a pre-filled SKILL.md

set -uo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/../lib.sh"

section "Skill Install URL"

# ── Setup ──────────────────────────────────────────────────────────────────
info "Creating a client API key..."
CREATE=$(curl -s -X POST "$BASE_URL/api/v1/keys" \
  -H "Content-Type: application/json" \
  -H "Cookie: $AUTH_COOKIE" \
  -d '{"name":"skill-install-test"}')

KEY_ID=$(echo "$CREATE" | jq -r '.key.id')
KEY_VAL=$(echo "$CREATE" | jq -r '.key.key')

[ -n "$KEY_ID" ] && [ "$KEY_ID" != "null" ] \
  && pass "key.id returned" \
  || { fail "key.id should be returned"; exit 1; }

# ── Test 1: Install URL returns 200 with SKILL.md content ──────────────────
section "1.1 - Install URL returns SKILL.md"
HTTP_CODE=$(curl -s -o /tmp/skill-install.txt -w "%{http_code}" \
  "$BASE_URL/api/v1/skill-install/$KEY_ID")
CONTENT=$(cat /tmp/skill-install.txt)

[ "$HTTP_CODE" = "200" ] \
  && pass "skill-install returns 200" \
  || fail "Expected 200, got $HTTP_CODE"

echo "$CONTENT" | grep -q "HeySummon" \
  && pass "SKILL.md contains HeySummon" \
  || fail "SKILL.md should contain 'HeySummon'"

echo "$CONTENT" | grep -q "$KEY_VAL" \
  && pass "SKILL.md contains API key" \
  || fail "SKILL.md should contain the API key"

echo "$CONTENT" | grep -q "$BASE_URL" \
  && pass "SKILL.md contains base URL" \
  || fail "SKILL.md should contain the base URL"

# ── Test 2: Invalid key ID returns 404 ────────────────────────────────────
section "1.2 - Invalid key ID returns 404"
STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
  "$BASE_URL/api/v1/skill-install/nonexistent-key-id")
[ "$STATUS" = "404" ] \
  && pass "Non-existent key returns 404" \
  || fail "Expected 404 for invalid key, got $STATUS"

# ── Test 3: Deactivated key returns 404 ───────────────────────────────────
section "1.3 - Deactivated key returns 404"
curl -s -X DELETE "$BASE_URL/api/v1/keys/$KEY_ID" \
  -H "Cookie: $AUTH_COOKIE" > /dev/null

STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
  "$BASE_URL/api/v1/skill-install/$KEY_ID")
[ "$STATUS" = "404" ] \
  && pass "Deactivated key returns 404" \
  || fail "Expected 404 for deactivated key, got $STATUS"

finish
