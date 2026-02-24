#!/bin/bash
# HeySummon E2E Test Suite — Main Runner
#
# Runs all test files in e2e/tests/ in order and reports aggregate results.
# Each test file is independently runnable: bash e2e/tests/01-health.sh
#
# Required env vars: E2E_PROVIDER_ID, E2E_PROVIDER_KEY, E2E_CLIENT_KEY
# Optional: E2E_BASE_URL, GUARD_URL, E2E_TIMEOUT, GUARD_SIGNING_KEY,
#           E2E_PROVIDER2_KEY, E2E_INACTIVE_KEY, E2E_DEVICE_KEY, E2E_DEVICE_TOKEN,
#           DATABASE_URL (for expiry tests)

set -uo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
TESTS_DIR="$SCRIPT_DIR/tests"

echo ""
echo "══════════════════════════════════════════════════"
echo "  🧪 HeySummon E2E Test Suite"
echo "══════════════════════════════════════════════════"
echo ""
echo -e "${CYAN}Platform:${NC}  ${E2E_BASE_URL:-http://localhost:3000}"
echo -e "${CYAN}Guard:${NC}     ${GUARD_URL:-http://localhost:3457}"
echo -e "${CYAN}Provider:${NC}  ${E2E_PROVIDER_ID:?Set E2E_PROVIDER_ID}"
echo ""

TOTAL_FILES=0
PASSED_FILES=0
FAILED_FILES=()

for test_file in "$TESTS_DIR"/*.sh; do
  [ -f "$test_file" ] || continue

  FILENAME=$(basename "$test_file")
  TOTAL_FILES=$((TOTAL_FILES + 1))

  echo -e "\n${CYAN}━━━ Running: $FILENAME ━━━${NC}"

  if bash "$test_file"; then
    PASSED_FILES=$((PASSED_FILES + 1))
  else
    FAILED_FILES+=("$FILENAME")
  fi
done

echo ""
echo "══════════════════════════════════════════════════"
if [ ${#FAILED_FILES[@]} -eq 0 ]; then
  echo -e "  ${GREEN}🎉 ALL $TOTAL_FILES TEST FILES PASSED${NC}"
else
  echo -e "  ${RED}❌ ${#FAILED_FILES[@]} of $TOTAL_FILES test files FAILED:${NC}"
  for f in "${FAILED_FILES[@]}"; do
    echo -e "     ${RED}• $f${NC}"
  done
fi
echo "══════════════════════════════════════════════════"
echo ""

[ ${#FAILED_FILES[@]} -eq 0 ]
