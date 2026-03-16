#!/bin/bash
# HeySummon Claude Code Skill — Setup
# Creates .env with API key and base URL

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SKILL_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
ENV_FILE="$SKILL_DIR/.env"

echo ""
echo "🦞 HeySummon — Claude Code Skill Setup"
echo "======================================="
echo ""

if [ -f "$ENV_FILE" ]; then
  echo "⚠️  .env already exists at: $ENV_FILE"
  read -p "Overwrite? (y/N): " OVERWRITE
  if [[ "$OVERWRITE" != "y" && "$OVERWRITE" != "Y" ]]; then
    echo "Setup cancelled."
    exit 0
  fi
fi

# Base URL
DEFAULT_URL="http://localhost:3425"
read -p "HeySummon base URL [$DEFAULT_URL]: " INPUT_URL
BASE_URL="${INPUT_URL:-$DEFAULT_URL}"

# API Key
echo ""
echo "Get your client API key from:"
echo "  Dashboard → Clients → Create client key"
echo "  (Keys start with hs_cli_...)"
echo ""
read -p "API key (hs_cli_...): " API_KEY

if [ -z "$API_KEY" ]; then
  echo "❌ API key is required."
  exit 1
fi

# Validate key against API
echo ""
echo "Validating API key..."
VALIDATE=$(curl -s -o /dev/null -w "%{http_code}" \
  -H "X-API-Key: $API_KEY" \
  "$BASE_URL/api/v1/events/pending" 2>/dev/null)

if [ "$VALIDATE" = "200" ] || [ "$VALIDATE" = "204" ]; then
  echo "✅ API key valid"
elif [ "$VALIDATE" = "401" ]; then
  echo "❌ Invalid API key (401). Check your key and try again."
  exit 1
else
  echo "⚠️  Could not validate (HTTP $VALIDATE) — saving anyway. Check your BASE_URL."
fi

# Write .env
cat > "$ENV_FILE" << EOF
HEYSUMMON_BASE_URL=$BASE_URL
HEYSUMMON_API_KEY=$API_KEY
HEYSUMMON_TIMEOUT=300
HEYSUMMON_POLL_INTERVAL=3
EOF

echo ""
echo "✅ Saved to: $ENV_FILE"
echo ""
echo "Add this to your CLAUDE.md or AGENTS.md:"
echo ""
echo "  ## HeySummon — Human in the Loop"
echo "  When you need human approval or are stuck, run:"
echo "  \`\`\`"
echo "  bash $SKILL_DIR/scripts/ask.sh \"Your question\""
echo "  \`\`\`"
echo "  Wait for the response before continuing."
echo ""
