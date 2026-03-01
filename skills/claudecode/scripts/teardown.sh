#!/bin/bash
# HeySummon Claude Code Skill — Teardown

set -e

echo ""
echo "🦞 HeySummon — Claude Code Skill Teardown"
echo ""

# Remove MCP server registration
claude mcp remove heysummon 2>/dev/null && echo "✅ MCP server removed" || echo "ℹ️  MCP server was not registered"

echo ""
echo "ℹ️  Note: HeySummon instructions in ~/.claude/CLAUDE.md were NOT removed."
echo "   Remove them manually if needed."
echo ""
echo "✅ Teardown complete."
