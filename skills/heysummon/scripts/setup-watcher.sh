#!/bin/bash
# HeySummon Claude Code Skill — Watcher PM2 lifecycle management
#
# Usage:
#   setup-watcher.sh start   — Start the response watcher via PM2
#   setup-watcher.sh stop    — Stop the watcher
#   setup-watcher.sh status  — Show watcher status + pending count
#   setup-watcher.sh restart — Restart the watcher
#   setup-watcher.sh logs    — Tail watcher log
#
# PM2 process name: heysummon-cc-watcher (distinct from OpenClaw's heysummon-watcher)

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SKILL_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
WATCHER="$SCRIPT_DIR/watcher.js"
PM2_NAME="heysummon-cc-watcher"
LOG_FILE="$SKILL_DIR/logs/watcher.log"

ACTION="${1:-start}"

# Ensure .env exists
if [ ! -f "$SKILL_DIR/.env" ]; then
  echo "No .env found. Run setup.sh first: bash $SCRIPT_DIR/setup.sh" >&2
  exit 1
fi

case "$ACTION" in
  start)
    # Ensure watcher.js exists
    if [ ! -f "$WATCHER" ]; then
      echo "watcher.js not found at $WATCHER" >&2
      exit 1
    fi

    # Ensure directories exist
    mkdir -p "$SKILL_DIR/pending" "$SKILL_DIR/inbox" "$SKILL_DIR/logs"

    if command -v pm2 &>/dev/null; then
      # Check if already running
      PM2_STATUS=$(pm2 show "$PM2_NAME" 2>/dev/null | grep "status" | head -1 | awk '{print $4}')
      if [ "$PM2_STATUS" = "online" ]; then
        echo "Watcher already running (pm2: $PM2_NAME)"
        exit 0
      fi

      pm2 delete "$PM2_NAME" 2>/dev/null
      pm2 start "$WATCHER" --name "$PM2_NAME" --interpreter node
      pm2 save 2>/dev/null
      echo "Watcher started via pm2 (name: $PM2_NAME)"
    else
      # Fallback: nohup
      PIDFILE="$SKILL_DIR/logs/watcher.pid"
      if [ -f "$PIDFILE" ] && kill -0 "$(cat "$PIDFILE")" 2>/dev/null; then
        echo "Watcher already running (pid: $(cat "$PIDFILE"))"
        exit 0
      fi

      nohup node "$WATCHER" >> "$LOG_FILE" 2>&1 &
      echo $! > "$PIDFILE"
      echo "Watcher started via nohup (pid: $(cat "$PIDFILE"), log: $LOG_FILE)"
    fi
    ;;

  stop)
    if command -v pm2 &>/dev/null; then
      pm2 delete "$PM2_NAME" 2>/dev/null
      pm2 save 2>/dev/null
      echo "Watcher stopped (pm2: $PM2_NAME)"
    else
      PIDFILE="$SKILL_DIR/logs/watcher.pid"
      if [ -f "$PIDFILE" ]; then
        PID=$(cat "$PIDFILE")
        if kill -0 "$PID" 2>/dev/null; then
          kill "$PID"
          echo "Watcher stopped (pid: $PID)"
        else
          echo "Process $PID was not running"
        fi
        rm -f "$PIDFILE"
      else
        echo "No pidfile found — watcher may not be running"
      fi
    fi
    ;;

  restart)
    bash "$0" stop
    sleep 1
    bash "$0" start
    ;;

  status)
    PENDING_COUNT=$(find "$SKILL_DIR/pending" -maxdepth 1 -name "*.json" 2>/dev/null | wc -l)
    PENDING_COUNT=$(echo "$PENDING_COUNT" | tr -d ' ')
    INBOX_COUNT=$(find "$SKILL_DIR/inbox" -maxdepth 1 -name "*.json" 2>/dev/null | wc -l)
    INBOX_COUNT=$(echo "$INBOX_COUNT" | tr -d ' ')

    echo "HeySummon CC Watcher Status"
    echo "==========================="

    if command -v pm2 &>/dev/null; then
      PM2_STATUS=$(pm2 show "$PM2_NAME" 2>/dev/null | grep "status" | head -1 | awk '{print $4}')
      if [ "$PM2_STATUS" = "online" ]; then
        echo "Watcher: RUNNING (pm2: $PM2_NAME)"
      else
        echo "Watcher: STOPPED"
      fi
    else
      PIDFILE="$SKILL_DIR/logs/watcher.pid"
      if [ -f "$PIDFILE" ] && kill -0 "$(cat "$PIDFILE")" 2>/dev/null; then
        echo "Watcher: RUNNING (pid: $(cat "$PIDFILE"))"
      else
        echo "Watcher: STOPPED"
      fi
    fi

    echo "Pending requests: $PENDING_COUNT"
    echo "Inbox responses: $INBOX_COUNT"
    ;;

  logs)
    if [ -f "$LOG_FILE" ]; then
      tail -50 "$LOG_FILE"
    else
      echo "No log file found at $LOG_FILE"
    fi
    ;;

  *)
    echo "Usage: setup-watcher.sh {start|stop|restart|status|logs}" >&2
    exit 1
    ;;
esac
