#!/bin/bash
# E2E Test 11: Skill Install URL
# Tests that /api/v1/skill-install/[keyId] returns a pre-filled SKILL.md

set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/../lib.sh"

section "Skill Install URL"

# ── Setup ──────────────────────────────────────────────────────────────────
log "Creating a client API key..."
CREATE=$(curl -s -X POST "$BASE_URL/api/v1/keys" \
  -H "Content-Type: application/json" \
  -H "Cookie: $AUTH_COOKIE" \
  -d '{"name":"skill-install-test"}')

KEY_ID=$(echo "$CREATE" | jq -r '.key.id')
KEY_VAL=$(echo "$CREATE" | jq -r '.key.key')
assert_not_empty "$KEY_ID" "key.id should be returned"
assert_not_empty "$KEY_VAL" "key.key should be returned"
log "Created key: $KEY_ID"

# ── Test 1: Install URL returns 200 with SKILL.md content ──────────────────
section "1.1 - Install URL returns SKILL.md"
SKILL=$(curl -s -o /tmp/skill-install.txt -w "%{http_code}" \
  "$BASE_URL/api/v1/skill-install/$KEY_ID")
assert_equals "200" "$SKILL" "skill-install should return 200"

CONTENT=$(cat /tmp/skill-install.txt)
assert_contains "$CONTENT" "HeySummon" "SKILL.md should contain HeySummon"
assert_contains "$CONTENT" "$KEY_VAL" "SKILL.md should contain the API key"
assert_contains "$CONTENT" "$BASE_URL" "SKILL.md should contain the base URL"
log "✅ SKILL.md returned with correct pre-filled config"

# ── Test 2: Invalid key ID returns 404 ────────────────────────────────────
section "1.2 - Invalid key ID returns 404"
STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
  "$BASE_URL/api/v1/skill-install/nonexistent-key-id")
assert_equals "404" "$STATUS" "invalid key should return 404"
log "✅ Non-existent key returns 404"

# ── Test 3: Deactivated key returns 404 ───────────────────────────────────
section "1.3 - Deactivated key returns 404"
curl -s -X DELETE "$BASE_URL/api/v1/keys/$KEY_ID" \
  -H "Cookie: $AUTH_COOKIE" > /dev/null
STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
  "$BASE_URL/api/v1/skill-install/$KEY_ID")
assert_equals "404" "$STATUS" "deactivated key should return 404"
log "✅ Deactivated key returns 404"

log "✅ All skill-install tests passed"
