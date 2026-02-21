#!/bin/bash
# Run E2E tests against local dev environment
# Prerequisites: platform (port 3456) + Mercure (port 3100) running
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PLATFORM_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "🌱 Seeding E2E data..."
cd "$PLATFORM_DIR"
SEED_JSON=$(bash e2e/seed-e2e.sh)
echo "$SEED_JSON" | jq .

export E2E_PROVIDER_ID=$(echo "$SEED_JSON" | jq -r '.providerId')
export E2E_PROVIDER_KEY=$(echo "$SEED_JSON" | jq -r '.providerKey')
export E2E_CLIENT_KEY=$(echo "$SEED_JSON" | jq -r '.clientKey')
export E2E_USER_ID=$(echo "$SEED_JSON" | jq -r '.userId')
export E2E_BASE_URL="http://localhost:3456"
export E2E_MERCURE_HUB="http://localhost:3100/.well-known/mercure"

echo ""
echo "🧪 Running E2E tests..."
bash "$SCRIPT_DIR/e2e-test.sh"
