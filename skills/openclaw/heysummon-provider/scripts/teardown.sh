#!/bin/bash
# HeySummon Provider — Stop the polling watcher

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SKILL_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
PIDFILE="$SKILL_DIR/watcher.pid"

if [ -f "$PIDFILE" ]; then
  PID=$(cat "$PIDFILE")
  if kill -0 "$PID" 2>/dev/null; then
    kill "$PID"
    echo "✅ Watcher stopped (PID: $PID)"
  else
    echo "⚠️ Process $PID was not running"
  fi
  rm -f "$PIDFILE"
else
  echo "⚠️ No pidfile found — watcher may not be running"
fi
