#!/bin/bash
# HeySummon — Skill Setup
# Creates .env with API key and base URL, registers provider, starts watcher.
# Auto-detects platform (OpenClaw vs Claude Code) and runs appropriate setup.

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SKILL_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
source "$SCRIPT_DIR/sdk.sh"
ENV_FILE="$SKILL_DIR/.env"

# --- Platform detection ---
# Detects which AI platform is running based on environment or config directories.
# OpenClaw: ~/.openclaw/ exists or OPENCLAW_HOME is set
# Codex CLI: CODEX_HOME is set or ~/.codex/ exists
# Gemini CLI: GEMINI_HOME is set or ~/.gemini/ exists
# Cursor: CURSOR_HOME is set or ~/.cursor/ exists
# Claude Code: default fallback
PLATFORM="claudecode"
if [ -d "$HOME/.openclaw" ] || [ -n "$OPENCLAW_HOME" ]; then
  PLATFORM="openclaw"
elif [ -d "$HOME/.codex" ] || [ -n "$CODEX_HOME" ]; then
  PLATFORM="codex"
elif [ -d "$HOME/.gemini" ] || [ -n "$GEMINI_HOME" ]; then
  PLATFORM="gemini"
elif [ -d "$HOME/.cursor" ] || [ -n "$CURSOR_HOME" ]; then
  PLATFORM="cursor"
fi

echo ""
echo "HeySummon — Skill Setup"
echo "======================="
echo "Platform: $PLATFORM"
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
EOF

echo ""
echo "Saved to: $ENV_FILE"

# Register provider
echo ""
echo "Registering provider..."
export HEYSUMMON_BASE_URL="$BASE_URL"
export HEYSUMMON_PROVIDERS_FILE="${HEYSUMMON_PROVIDERS_FILE:-$HOME/.heysummon/providers.json}"
$SDK_CLI add-provider --key "$API_KEY" 2>/dev/null && echo "" || echo "Provider registration skipped (non-fatal)."

# --- Platform-specific watcher setup ---
if [ "$PLATFORM" = "openclaw" ]; then
  echo ""
  echo "Running OpenClaw setup (keypairs, hooks, watcher)..."
  bash "$SCRIPT_DIR/openclaw-setup.sh"
else
  echo ""
  echo "Starting $PLATFORM response watcher..."
  bash "$SCRIPT_DIR/setup-watcher.sh" start
fi

echo ""
echo "Setup complete. Use HeySummon:"
echo ""
echo "  bash $SKILL_DIR/scripts/ask.sh \"Your question\""
echo "  bash $SKILL_DIR/scripts/ask.sh --async \"Your question\""
echo "  bash $SKILL_DIR/scripts/ask.sh --check"
echo ""
