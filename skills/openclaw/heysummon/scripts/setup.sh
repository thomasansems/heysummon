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

# === Generate & register hooks token ===
# A unique token is generated once at install time. It is stored in .env and
# registered in ~/.openclaw/openclaw.json so the OpenClaw gateway accepts it.
[ -f "$SKILL_DIR/.env" ] && set -a && source "$SKILL_DIR/.env" && set +a

HOOKS_TOKEN="${HEYSUMMON_HOOKS_TOKEN:-}"
if [ -z "$HOOKS_TOKEN" ]; then
  HOOKS_TOKEN=$(node -e "console.log(require('crypto').randomBytes(24).toString('hex'))" 2>/dev/null)
  echo "🔑 Generated new hooks token: ${HOOKS_TOKEN:0:8}..."
  # Persist to .env
  if grep -q "HEYSUMMON_HOOKS_TOKEN" "$SKILL_DIR/.env" 2>/dev/null; then
    sed -i "s|^HEYSUMMON_HOOKS_TOKEN=.*|HEYSUMMON_HOOKS_TOKEN=$HOOKS_TOKEN|" "$SKILL_DIR/.env"
  else
    echo "HEYSUMMON_HOOKS_TOKEN=$HOOKS_TOKEN" >> "$SKILL_DIR/.env"
  fi
fi

# Auto-detect session key from OpenClaw config if not set
OPENCLAW_CONFIG="$HOME/.openclaw/openclaw.json"
if [ -f "$OPENCLAW_CONFIG" ]; then
  # Detect the agent's primary session key from active sessions
  DETECTED_SESSION_KEY=$(node -e "
    try {
      const cfg = JSON.parse(require('fs').readFileSync(process.argv[1], 'utf8'));
      const agentId = process.env.HEYSUMMON_AGENT_ID || 'tertiary';
      // Build expected session key pattern
      const agent = (cfg.agents?.list||[]).find(a=>a.id===agentId);
      console.log(cfg.hooks?.defaultSessionKey || '');
    } catch(e) { console.log(''); }
  " "$OPENCLAW_CONFIG" 2>/dev/null)

  # Update or create hooks config in openclaw.json
  node -e "
    const fs = require('fs');
    const path = process.argv[1];
    const token = process.argv[2];
    const sessionKey = process.argv[3] || process.env.HEYSUMMON_SESSION_KEY || '';
    const agentId = process.env.HEYSUMMON_AGENT_ID || 'tertiary';

    try {
      const cfg = JSON.parse(fs.readFileSync(path, 'utf8'));
      if (!cfg.hooks) cfg.hooks = {};
      cfg.hooks.enabled = true;
      cfg.hooks.token = token;
      if (sessionKey) cfg.hooks.defaultSessionKey = sessionKey;
      cfg.hooks.allowRequestSessionKey = true;
      if (sessionKey) {
        // Allow only this agent's session prefix
        const prefix = sessionKey.split(':').slice(0,2).join(':');
        cfg.hooks.allowedSessionKeyPrefixes = [prefix];
      }
      if (!cfg.hooks.allowedAgentIds) cfg.hooks.allowedAgentIds = [];
      if (!cfg.hooks.allowedAgentIds.includes(agentId)) {
        cfg.hooks.allowedAgentIds.push(agentId);
      }
      fs.writeFileSync(path, JSON.stringify(cfg, null, 2));
      console.log('✅ openclaw.json hooks config updated');
    } catch(e) {
      console.error('⚠️  Could not update openclaw.json:', e.message);
    }
  " "$OPENCLAW_CONFIG" "$HOOKS_TOKEN" "$DETECTED_SESSION_KEY" 2>/dev/null

  echo "⚠️  Run: openclaw gateway restart  (to activate new hooks token)"
fi

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
