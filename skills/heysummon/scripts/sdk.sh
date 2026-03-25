#!/bin/bash
# HeySummon SDK CLI resolver
# Sources this file to get SDK_CLI — the command to invoke the SDK CLI.
#
# Resolution order:
#   1. npx @heysummon/consumer-sdk (if published to npm)
#   2. npx tsx <git-root>/packages/consumer-sdk/src/cli.ts (dev/monorepo)
#   3. HEYSUMMON_SDK_DIR env var override

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

_resolve_sdk() {
  # Override: explicit SDK dir
  if [ -n "$HEYSUMMON_SDK_DIR" ] && [ -f "$HEYSUMMON_SDK_DIR/dist/cli.js" ]; then
    echo "node $HEYSUMMON_SDK_DIR/dist/cli.js"
    return
  fi

  # Try git root (monorepo development)
  local GIT_ROOT
  GIT_ROOT="$(git -C "$SCRIPT_DIR" rev-parse --show-toplevel 2>/dev/null)"
  if [ -n "$GIT_ROOT" ] && [ -f "$GIT_ROOT/packages/consumer-sdk/dist/cli.js" ]; then
    echo "node $GIT_ROOT/packages/consumer-sdk/dist/cli.js"
    return
  fi

  # Fallback: npm package (when installed via npx skills add)
  echo "npx @heysummon/consumer-sdk"
}

SDK_CLI="$(_resolve_sdk)"
