#!/bin/bash
# HeySummon Provider — Start the polling watcher

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SKILL_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
[ -f "$SKILL_DIR/.env" ] && set -a && source "$SKILL_DIR/.env" && set +a

WATCHER="$SCRIPT_DIR/poll-watcher.sh"
PIDFILE="$SKILL_DIR/watcher.pid"
LOGFILE="$SKILL_DIR/watcher.log"

if ! [ -f "$WATCHER" ]; then
  echo "❌ Watcher script not found" >&2
  exit 1
fi

# Validate required env vars
if [ -z "$HEYSUMMON_BASE_URL" ]; then
  echo "❌ HEYSUMMON_BASE_URL is required in .env" >&2
  exit 1
fi
if [ -z "$HEYSUMMON_API_KEY" ]; then
  echo "❌ HEYSUMMON_API_KEY is required in .env" >&2
  exit 1
fi
if [ -z "$HEYSUMMON_NOTIFY_TARGET" ]; then
  echo "❌ HEYSUMMON_NOTIFY_TARGET is required in .env (e.g. your Telegram chat ID)" >&2
  exit 1
fi

chmod +x "$WATCHER"

# Stop any existing watcher
if [ -f "$PIDFILE" ] && kill -0 "$(cat "$PIDFILE")" 2>/dev/null; then
  kill "$(cat "$PIDFILE")" 2>/dev/null
  echo "⏹️ Stopped existing watcher"
fi

nohup bash "$WATCHER" >> "$LOGFILE" 2>&1 &
echo $! > "$PIDFILE"
echo "✅ Polling watcher started (PID: $(cat "$PIDFILE"), log: $LOGFILE)"
echo "   Poll interval: ${HEYSUMMON_POLL_INTERVAL:-30}s"
