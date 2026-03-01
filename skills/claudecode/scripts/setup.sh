#!/bin/bash
# HeySummon Claude Code Skill — Setup
# Registers the MCP server and adds CLAUDE.md instructions

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SKILL_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
MCP_DIR="$SKILL_DIR/mcp-server"

echo ""
echo "🦞 HeySummon — Claude Code Skill Setup"
echo "======================================="
echo ""

# Step 1: Collect credentials
if [ -f "$SKILL_DIR/.env" ]; then
  echo "ℹ️  Found existing .env — using saved credentials."
  source "$SKILL_DIR/.env"
else
  read -rp "HeySummon Base URL [https://cloud.heysummon.ai]: " BASE_URL
  BASE_URL="${BASE_URL:-https://cloud.heysummon.ai}"

  read -rp "HeySummon API Key (hs_cli_...): " API_KEY
  if [ -z "$API_KEY" ]; then
    echo "❌ API key is required."
    exit 1
  fi

  cat > "$SKILL_DIR/.env" <<EOF
HEYSUMMON_BASE_URL=$BASE_URL
HEYSUMMON_API_KEY=$API_KEY
EOF
  echo "✅ Credentials saved to $SKILL_DIR/.env"
fi

# Step 2: Install MCP server dependencies
echo ""
echo "📦 Installing MCP server dependencies..."
cd "$MCP_DIR" && npm install --silent
echo "✅ Dependencies installed"

# Step 3: Register MCP server with Claude Code
echo ""
echo "🔌 Registering MCP server with Claude Code..."
claude mcp add heysummon node "$MCP_DIR/index.js" 2>/dev/null \
  || claude mcp add heysummon -- node "$MCP_DIR/index.js"
echo "✅ MCP server registered"

# Step 4: Add CLAUDE.md instructions
CLAUDE_MD="$HOME/.claude/CLAUDE.md"
mkdir -p "$HOME/.claude"

if grep -q "HeySummon" "$CLAUDE_MD" 2>/dev/null; then
  echo ""
  echo "ℹ️  HeySummon instructions already in $CLAUDE_MD — skipping."
else
  echo "" >> "$CLAUDE_MD"
  cat "$SKILL_DIR/CLAUDE.md" >> "$CLAUDE_MD"
  echo "✅ Instructions added to $CLAUDE_MD"
fi

echo ""
echo "🎉 Setup complete! HeySummon is now available in Claude Code."
echo ""
echo "   Test it: ask Claude Code to use the heysummon tool"
echo "   Remove:  bash $SCRIPT_DIR/teardown.sh"
echo ""
