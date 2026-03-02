#!/bin/bash
# Run MCP E2E test locally against a running HeySummon instance.
#
# Usage:
#   bash e2e/run-mcp-local.sh                    # uses localhost:3425 (default)
#   E2E_BASE_URL=http://localhost:3000 bash ...  # custom URL
#   SKIP_SEED=1 bash ...                         # skip seeding (reuse existing keys)
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

BASE_URL="${E2E_BASE_URL:-http://localhost:3425}"
SKIP_SEED="${SKIP_SEED:-}"
TIMEOUT="${E2E_TIMEOUT:-30}"

echo "═══════════════════════════════════════════════"
echo "  🤖 HeySummon MCP E2E — Local Runner"
echo "  Platform: $BASE_URL"
echo "═══════════════════════════════════════════════"
echo ""

# ── Health check ──
echo "🔍 Checking platform health..."
HEALTH=$(curl -s "$BASE_URL/api/v1/health" 2>/dev/null || echo '{}')
if echo "$HEALTH" | jq -e '.status == "ok"' > /dev/null 2>&1; then
  echo "✅ Platform is up"
else
  echo "❌ Platform not reachable at $BASE_URL"
  echo "   Start it with: npm run dev  (or pm2 restart heysummon)"
  exit 1
fi
echo ""

# ── Seed test data ──
if [ -z "$SKIP_SEED" ]; then
  echo "🌱 Seeding MCP test data..."
  cd "$PROJECT_DIR"
  SEED_OUTPUT=$(bash e2e/seed-mcp.sh)
  echo "   $(echo "$SEED_OUTPUT" | jq -r '"Provider key: " + .providerKey[:20] + "..."')"
  echo "   $(echo "$SEED_OUTPUT" | jq -r '"Client key:   " + .clientKey[:20] + "..."')"
else
  echo "⏭️  Skipping seed (SKIP_SEED=1)"
  if [ -z "${E2E_PROVIDER_KEY:-}" ] || [ -z "${E2E_CLIENT_KEY:-}" ]; then
    echo "❌ SKIP_SEED set but E2E_PROVIDER_KEY / E2E_CLIENT_KEY not exported"
    exit 1
  fi
  SEED_OUTPUT="{}"
fi
echo ""

# ── Export env vars for test ──
export E2E_BASE_URL="$BASE_URL"
export E2E_PROVIDER_ID=$([ -z "$SKIP_SEED" ] && echo "$SEED_OUTPUT" | jq -r '.providerId' || echo "${E2E_PROVIDER_ID:-}")
export E2E_PROVIDER_KEY=$([ -z "$SKIP_SEED" ] && echo "$SEED_OUTPUT" | jq -r '.providerKey' || echo "${E2E_PROVIDER_KEY:-}")
export E2E_CLIENT_KEY=$([ -z "$SKIP_SEED" ] && echo "$SEED_OUTPUT" | jq -r '.clientKey' || echo "${E2E_CLIENT_KEY:-}")
export E2E_USER_ID=$([ -z "$SKIP_SEED" ] && echo "$SEED_OUTPUT" | jq -r '.userId' || echo "${E2E_USER_ID:-}")
export E2E_TIMEOUT="$TIMEOUT"
export E2E_RATE_LIMIT_BYPASS_SECRET="${E2E_RATE_LIMIT_BYPASS_SECRET:-}"
export GUARD_URL="${GUARD_URL:-}"

# ── Run MCP test ──
echo "🧪 Running MCP flow test..."
echo ""
bash "$SCRIPT_DIR/tests/11-mcp-flow.sh"
