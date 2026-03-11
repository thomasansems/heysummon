#!/bin/bash
# HeySummon Consumer Watcher — Setup
# Starts the platform event stream watcher as a persistent background process.
# Uses pm2 if available, otherwise nohup.

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
WATCHER="$SCRIPT_DIR/platform-watcher.sh"
NAME="heysummon-watcher"

if ! [ -f "$WATCHER" ]; then
  echo "❌ platform-watcher.sh not found in $SCRIPT_DIR" >&2
  exit 1
fi

chmod +x "$WATCHER"

# Determine skill directory
SKILL_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

# Ensure keypairs exist
KEY_DIR="${HEYSUMMON_KEY_DIR:-$SKILL_DIR/.keys}"
if [ ! -f "$KEY_DIR/sign_public.pem" ]; then
  echo "⚠️ No keypairs found. Generating in $KEY_DIR..."
  CRYPTO="$SCRIPT_DIR/crypto.mjs"
  if [ -f "$CRYPTO" ]; then
    node "$CRYPTO" keygen "$KEY_DIR"
    echo "✅ Keypairs generated in $KEY_DIR"
  else
    echo "❌ crypto.mjs not found — generate keys manually: node crypto.mjs keygen $KEY_DIR" >&2
    exit 1
  fi
fi

# Ensure active-requests directory exists
mkdir -p "${HEYSUMMON_REQUESTS_DIR:-$SKILL_DIR/.requests}"

# === Install workspace hook ===
# Auto-install the heysummon-responder hook into the agent's workspace hooks dir
HOOK_SRC="$SKILL_DIR/hooks/heysummon-responder"
if [ -d "$HOOK_SRC" ]; then
  # Load .env to get HEYSUMMON_AGENT_ID
  [ -f "$SKILL_DIR/.env" ] && set -a && source "$SKILL_DIR/.env" && set +a
  AGENT_ID="${HEYSUMMON_AGENT_ID:-tertiary}"

  # Resolve workspace dir from openclaw.json
  OPENCLAW_CONFIG="$HOME/.openclaw/openclaw.json"
  WORKSPACE_DIR=""
  if [ -f "$OPENCLAW_CONFIG" ]; then
    WORKSPACE_DIR=$(node -e "
      try {
        const cfg = JSON.parse(require('fs').readFileSync(process.argv[1], 'utf8'));
        const agent = (cfg.agents?.list || []).find(a => a.id === process.argv[2]);
        const ws = agent?.workspace || cfg.agents?.defaults?.workspace || '';
        console.log(ws);
      } catch(e) { console.log(''); }
    " "$OPENCLAW_CONFIG" "$AGENT_ID" 2>/dev/null)
  fi

  # Install to managed hooks dir (~/.openclaw/hooks/) — shared across all agents
  MANAGED_HOOKS="$HOME/.openclaw/hooks"
  mkdir -p "$MANAGED_HOOKS"
  HOOK_DEST="$MANAGED_HOOKS/heysummon-responder"
  rm -rf "$HOOK_DEST"
  cp -r "$HOOK_SRC" "$HOOK_DEST"
  echo "🦞 Hook installed: $HOOK_DEST"
  echo "⚠️  Restart the OpenClaw gateway to activate the hook:"
  echo "   openclaw gateway restart"
else
  echo "⚠️  Hook source not found at $HOOK_SRC"
fi

if command -v pm2 &>/dev/null; then
  pm2 delete "$NAME" 2>/dev/null
  pm2 start "$WATCHER" --name "$NAME" --interpreter bash
  pm2 save
  echo "✅ Consumer watcher started via pm2 (name: $NAME)"
else
  LOGFILE="$SCRIPT_DIR/watcher.log"
  PIDFILE="$SCRIPT_DIR/watcher.pid"

  if [ -f "$PIDFILE" ] && kill -0 "$(cat "$PIDFILE")" 2>/dev/null; then
    kill "$(cat "$PIDFILE")" 2>/dev/null
  fi

  nohup bash "$WATCHER" >> "$LOGFILE" 2>&1 &
  echo $! > "$PIDFILE"
  echo "✅ Consumer watcher started via nohup (PID: $(cat "$PIDFILE"), log: $LOGFILE)"
fi
