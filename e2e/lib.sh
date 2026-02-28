#!/bin/bash
# HeySummon E2E — Shared test helpers
# Source this file from test scripts: source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

# ── Colors ──
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

# ── Test counters ──
TESTS_PASSED=0
TESTS_FAILED=0
TESTS_SKIPPED=0

pass() { TESTS_PASSED=$((TESTS_PASSED + 1)); echo -e "${GREEN}✅ $1${NC}"; }
fail() { TESTS_FAILED=$((TESTS_FAILED + 1)); echo -e "${RED}❌ $1${NC}"; }
skip() { TESTS_SKIPPED=$((TESTS_SKIPPED + 1)); echo -e "${YELLOW}⏭️  SKIP: $1${NC}"; }
info() { echo -e "${YELLOW}ℹ️  $1${NC}"; }
section() { echo -e "\n${CYAN}── $1 ──${NC}"; }

# ── Resolve project root ──
LIB_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$LIB_DIR/.." && pwd)"

# ── Config (env vars with defaults) ──
BASE_URL="${E2E_BASE_URL:-http://localhost:3000}"
GUARD_URL="${GUARD_URL:-http://localhost:3457}"
E2E_RATE_LIMIT_BYPASS_SECRET="${E2E_RATE_LIMIT_BYPASS_SECRET:-}"

# Bypass header args for direct curl calls (empty array if no secret set)
# Usage: curl ... "${E2E_BYPASS_ARGS[@]}" ...
if [ -n "$E2E_RATE_LIMIT_BYPASS_SECRET" ]; then
  E2E_BYPASS_ARGS=(-H "x-e2e-bypass: ${E2E_RATE_LIMIT_BYPASS_SECRET}")
else
  E2E_BYPASS_ARGS=()
fi
PROVIDER_ID="${E2E_PROVIDER_ID:?Set E2E_PROVIDER_ID}"
USER_ID="${E2E_USER_ID:-$PROVIDER_ID}"
PROVIDER_KEY="${E2E_PROVIDER_KEY:?Set E2E_PROVIDER_KEY}"
CLIENT_KEY="${E2E_CLIENT_KEY:?Set E2E_CLIENT_KEY}"
TIMEOUT="${E2E_TIMEOUT:-30}"
STREAM_URL="${BASE_URL}/api/v1/events/stream"

# Extended test keys (optional — tests skip if not set)
PROVIDER2_KEY="${E2E_PROVIDER2_KEY:-}"
PROVIDER2_CLIENT_KEY="${E2E_PROVIDER2_CLIENT_KEY:-}"
INACTIVE_KEY="${E2E_INACTIVE_KEY:-}"
DEVICE_KEY="${E2E_DEVICE_KEY:-}"
DEVICE_TOKEN="${E2E_DEVICE_TOKEN:-}"

# ── Temp dir and PID tracking ──
TMPDIR=$(mktemp -d)
PIDS=()

CLEANUP() {
  for pid in "${PIDS[@]}"; do
    kill "$pid" 2>/dev/null || true
  done
  rm -rf "$TMPDIR"
}
trap CLEANUP EXIT

# ── Helper: generate ephemeral crypto keys (Ed25519 + X25519) ──
generate_crypto_keys() {
  node -e "
const crypto = require('crypto');
const sign = crypto.generateKeyPairSync('ed25519', {
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});
const enc = crypto.generateKeyPairSync('x25519', {
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});
console.log(JSON.stringify({
  signPublicKey: sign.publicKey,
  encryptPublicKey: enc.publicKey,
}));
"
}

# ── Helper: submit a help request, returns JSON body + HTTP code on last line ──
submit_help() {
  local url="${1}"
  local api_key="${2}"
  local question="${3:-E2E test $(date +%s)}"
  shift 3
  local extra_curl_args=("$@")

  local KEYS_JSON
  KEYS_JSON=$(generate_crypto_keys)
  local SIGN_PUB ENC_PUB
  SIGN_PUB=$(echo "$KEYS_JSON" | jq -r '.signPublicKey')
  ENC_PUB=$(echo "$KEYS_JSON" | jq -r '.encryptPublicKey')

  local BODY
  BODY=$(jq -n \
    --arg apiKey "$api_key" \
    --arg signPublicKey "$SIGN_PUB" \
    --arg encryptPublicKey "$ENC_PUB" \
    --arg question "$question" \
    '{apiKey: $apiKey, signPublicKey: $signPublicKey, encryptPublicKey: $encryptPublicKey, question: $question, messages: []}')

  local bypass_header=()
  [ -n "$E2E_RATE_LIMIT_BYPASS_SECRET" ] && bypass_header=(-H "x-e2e-bypass: ${E2E_RATE_LIMIT_BYPASS_SECRET}")

  curl -s -w '\n%{http_code}' -X POST "${url}/api/v1/help" \
    -H "Content-Type: application/json" \
    "${bypass_header[@]}" \
    "${extra_curl_args[@]}" \
    -d "$BODY"
}

# ── Helper: parse response body and HTTP code from curl output ──
# Usage: RESULT=$(submit_help ...); BODY=$(parse_body "$RESULT"); CODE=$(parse_code "$RESULT")
parse_body() { echo "$1" | sed '$d'; }
parse_code() { echo "$1" | tail -1; }

# ── Print summary and exit ──
finish() {
  CLEANUP
  echo ""
  echo "────────────────────────────────"
  if [ "$TESTS_FAILED" -gt 0 ]; then
    echo -e "  ${RED}$TESTS_FAILED failed${NC}, ${GREEN}$TESTS_PASSED passed${NC}"
  else
    echo -e "  ${GREEN}All $TESTS_PASSED tests passed${NC}"
  fi
  if [ "$TESTS_SKIPPED" -gt 0 ]; then
    echo -e "  ${YELLOW}$TESTS_SKIPPED skipped${NC}"
  fi
  echo "────────────────────────────────"
  echo ""
  [ "$TESTS_FAILED" -eq 0 ]
}
