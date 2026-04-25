#!/bin/bash
# HeySummon — Skill Setup
# Creates .env with API key and base URL, registers expert.

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SKILL_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
source "$SCRIPT_DIR/sdk.sh"
source "$SCRIPT_DIR/_lib.sh"
ENV_FILE="$(heysummon_resolve_env_write)"

echo ""
echo "HeySummon — Skill Setup"
echo "======================="
echo ""

if [ -f "$ENV_FILE" ]; then
  echo "Warning: .env already exists at: $ENV_FILE"
  read -p "Overwrite? (y/N): " OVERWRITE
  if [[ "$OVERWRITE" != "y" && "$OVERWRITE" != "Y" ]]; then
    echo "Setup cancelled."
    exit 0
  fi
fi

DEFAULT_URL="http://localhost:3425"
read -p "HeySummon base URL [$DEFAULT_URL]: " INPUT_URL
BASE_URL="${INPUT_URL:-$DEFAULT_URL}"

echo ""
echo "Get your client API key from:"
echo "  Dashboard -> Clients -> Create client key"
echo "  (Keys start with hs_cli_...)"
echo ""
read -p "API key (hs_cli_...): " API_KEY

if [ -z "$API_KEY" ]; then
  echo "API key is required."
  exit 1
fi

echo ""
echo "Validating API key..."
VALIDATE=$(curl -s -o /dev/null -w "%{http_code}" \
  -H "X-API-Key: $API_KEY" \
  "$BASE_URL/api/v1/events/pending" 2>/dev/null)

if [ "$VALIDATE" = "200" ] || [ "$VALIDATE" = "204" ]; then
  echo "API key valid"
elif [ "$VALIDATE" = "401" ]; then
  echo "Invalid API key (401). Check your key and try again."
  exit 1
else
  echo "Could not validate (HTTP $VALIDATE) — saving anyway."
fi

cat > "$ENV_FILE" << EOF
HEYSUMMON_BASE_URL=$BASE_URL
HEYSUMMON_API_KEY=$API_KEY
HEYSUMMON_TIMEOUT=900
HEYSUMMON_POLL_INTERVAL=3
HEYSUMMON_TIMEOUT_FALLBACK=proceed_cautiously
EOF

echo ""
echo "Saved to: $ENV_FILE"

# Register expert
echo ""
echo "Registering expert..."
export HEYSUMMON_BASE_URL="$BASE_URL"
export HEYSUMMON_EXPERTS_FILE="${HEYSUMMON_EXPERTS_FILE:-$HOME/.heysummon/experts.json}"
$SDK_CLI add-expert --key "$API_KEY" 2>/dev/null && echo "" || echo "Expert registration skipped (non-fatal)."

echo ""
echo "Setup complete. Use HeySummon:"
echo ""
echo "  bash $SKILL_DIR/scripts/ask.sh \"Your question\""
echo ""
