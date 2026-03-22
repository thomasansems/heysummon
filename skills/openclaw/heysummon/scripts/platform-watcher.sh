#!/bin/bash
# HeySummon Consumer Watcher — HTTP polling for pending events
# Thin wrapper around the SDK CLI watch command.
# OpenClaw-specific notification logic lives in notify.sh.

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SKILL_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
SDK_DIR="${HEYSUMMON_SDK_DIR:-$(git -C "$SCRIPT_DIR" rev-parse --show-toplevel 2>/dev/null)/packages/consumer-sdk}"

[ -f "$SKILL_DIR/.env" ] && set -a && source "$SKILL_DIR/.env" && set +a

export HEYSUMMON_BASE_URL="${HEYSUMMON_BASE_URL:-http://localhost:3445}"
export HEYSUMMON_PROVIDERS_FILE="${HEYSUMMON_PROVIDERS_FILE:-$HOME/.heysummon/providers.json}"
export HEYSUMMON_REQUESTS_DIR="${HEYSUMMON_REQUESTS_DIR:-$SKILL_DIR/.requests}"
export HEYSUMMON_POLL_INTERVAL="${HEYSUMMON_POLL_INTERVAL:-5}"

exec npx tsx "$SDK_DIR/src/cli.ts" watch --notify-script "$SCRIPT_DIR/notify.sh"
