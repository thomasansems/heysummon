#!/bin/bash
# E2E Test 11: Skill Install URL
# Tests that /api/v1/skill-install/[keyId] returns a pre-filled SKILL.md

set -uo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/../lib.sh"

section "Skill Install URL"

# Use existing client key from CI environment
CLIENT_KEY="${E2E_CLIENT_KEY:-}"
[ -z "$CLIENT_KEY" ] && skip "E2E_CLIENT_KEY not set" && finish

# Extract key ID from the key (format: hs_live_xxx)
# We need to look up the key ID via API - use /api/v1/keys which needs auth
# But we can test with just the key value since the endpoint is public

# ── Test 1: Install URL with valid key prefix ─────────────────────────────────
section "1.1 - Install URL works with valid key"

# First, get the key ID by listing keys (need provider auth)
KEYS_RESPONSE=$(curl -s -H "x-api-key: ${PROVIDER_KEY}" "$BASE_URL/api/v1/keys")
KEY_ID=$(echo "$KEYS_RESPONSE" | jq -r '.keys[] | select(.key == "'"$CLIENT_KEY"'") | .id' | head -1)

if [ -z "$KEY_ID" ] || [ "$KEY_ID" = "null" ]; then
  # Try to get any active client key
  KEY_ID=$(echo "$KEYS_RESPONSE" | jq -r '.keys[] | select(.scope == "client") | .id' | head -1)
fi

if [ -z "$KEY_ID" ] || [ "$KEY_ID" = "null" ]; then
  skip "No client key found"
  finish
fi

info "Using key ID: $KEY_ID"

HTTP_CODE=$(curl -s -o /tmp/skill-install.txt -w "%{http_code}" \
  "$BASE_URL/api/v1/skill-install/$KEY_ID")
CONTENT=$(cat /tmp/skill-install.txt)

[ "$HTTP_CODE" = "200" ] \
  && pass "skill-install returns 200" \
  || fail "Expected 200, got $HTTP_CODE"

echo "$CONTENT" | grep -q "HeySummon" \
  && pass "SKILL.md contains HeySummon" \
  || fail "SKILL.md should contain 'HeySummon'"

echo "$CONTENT" | grep -q "HEYSUMMON_BASE_URL" \
  && pass "SKILL.md contains HEYSUMMON_BASE_URL" \
  || fail "SKILL.md should contain HEYSUMMON_BASE_URL"

echo "$CONTENT" | grep -q "HEYSUMMON_API_KEY" \
  && pass "SKILL.md contains HEYSUMMON_API_KEY" \
  || fail "SKILL.md should contain HEYSUMMON_API_KEY"

# ── Test 2: Invalid key ID returns 404 ────────────────────────────────────
section "1.2 - Invalid key ID returns 404"
STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
  "$BASE_URL/api/v1/skill-install/nonexistent-key-id")
[ "$STATUS" = "404" ] \
  && pass "Non-existent key returns 404" \
  || fail "Expected 404 for invalid key, got $STATUS"

# ── Test 3: Provider key returns 400 ─────────────────────────────────────
section "1.3 - Provider key returns 400"
# Try with provider key ID
PROV_KEY_ID=$(echo "$KEYS_RESPONSE" | jq -r '.keys[] | select(.scope == "provider") | .id' | head -1)

if [ -n "$PROV_KEY_ID" ] && [ "$PROV_KEY_ID" != "null" ]; then
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
    "$BASE_URL/api/v1/skill-install/$PROV_KEY_ID")
  [ "$STATUS" = "400" ] \
    && pass "Provider key returns 400" \
    || fail "Expected 400 for provider key, got $STATUS"
else
  skip "No provider key found"
fi

finish
