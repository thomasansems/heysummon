#!/usr/bin/env bash
set -euo pipefail

# HeySummon — Local Development Setup Wizard
# -------------------------------------------
# Interactive setup for local development. Generates .env.local, configures
# public access (if needed), creates the database, and gets you ready to
# run `pnpm dev`.
#
# Usage:
#   bash install-local-dev.sh

BLUE='\033[0;34m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'
BOLD='\033[1m'; DIM='\033[2m'; NC='\033[0m'

info() { echo -e "  ${DIM}.${NC} $*"; }
ok()   { echo -e "  ${GREEN}.${NC} $*"; }
warn() { echo -e "  ${YELLOW}.${NC} $*"; }
die()  { echo -e "  ${RED}.${NC} $*" >&2; exit 1; }
step() { echo -e "  ${GREEN}>${NC} ${BOLD}$*${NC}"; }

SUMMON_LINES=(
  "Thomas|About to delete 847 prod records. You sure about that?"
  "Sarah|Found a \$200 cheaper flight. It leaves at 4:47 AM though."
  "Mark|Email draft says 'As per my last email'. Send it like that?"
  "Lisa|New vendor invoice: \$2,400. Never seen this account before."
  "James|Ad budget is gone. Pause everything or throw in another \$500?"
  "Anna|That PR has 6 major issues. Post the honest review or sugarcoat it?"
)

print_banner() {
  echo ""
  echo -e "${BOLD}${YELLOW}  _                                                          ${NC}"
  echo -e "${BOLD}${YELLOW} | |__   ___ _   _   ___ _   _ _ __ ___  _ __ ___   ___  _ __${NC}"
  echo -e "${BOLD}${YELLOW} |  _ \\ / _ \\ | | | / __| | | | '_ \` _ \\| '_ \` _ \\ / _ \\| '_ \\${NC}"
  echo -e "${BOLD}${YELLOW} | | | |  __/ |_| | \\__ \\ |_| | | | | | | | | | | | (_) | | | |${NC}"
  echo -e "${BOLD}${YELLOW} |_| |_|\\___|\\__, | |___/\\__,_|_| |_| |_|_| |_| |_|\\___/|_| |_|${NC}"
  echo -e "${BOLD}${YELLOW}             |___/                                            ${NC}"
  echo ""
  echo -e "  ${DIM}AI does the work. Humans make the calls. Local Development Setup${NC}"
  echo ""
}

animate_taglines() {
  if [[ ! -t 1 ]] || [[ "${CI:-}" == "true" ]]; then
    local entry="${SUMMON_LINES[0]}"
    local name="${entry%%|*}"
    local question="${entry#*|}"
    printf "  ${DIM}>${NC} ${BOLD}${YELLOW}hey summon${NC} ${BOLD}%s${NC} ${DIM}%s${NC}\n" "$name" "$question"
    echo ""
    return
  fi

  local cycles=2
  local shuffled=()
  local indices=()
  for i in "${!SUMMON_LINES[@]}"; do indices+=("$i"); done
  for ((i=${#indices[@]}-1; i>0; i--)); do
    j=$((RANDOM % (i+1)))
    tmp="${indices[$i]}"; indices[$i]="${indices[$j]}"; indices[$j]="$tmp"
  done
  for i in "${indices[@]}"; do shuffled+=("${SUMMON_LINES[$i]}"); done

  for ((c=0; c<cycles; c++)); do
    local entry="${shuffled[$c]}"
    local name="${entry%%|*}"
    local question="${entry#*|}"
    local full="${name} ${question}"
    local len=${#full}

    for ((i=1; i<=len; i++)); do
      local typed="${full:0:$i}"
      local name_len=${#name}
      if ((i <= name_len)); then
        printf "\r\033[K  ${DIM}>${NC} ${BOLD}${YELLOW}hey summon${NC} ${BOLD}%s${NC}" "$typed"
      else
        printf "\r\033[K  ${DIM}>${NC} ${BOLD}${YELLOW}hey summon${NC} ${BOLD}%s${NC} ${DIM}%s${NC}" "$name" "${typed:$((name_len+1))}"
      fi
      sleep 0.02
    done

    sleep 1.2

    if ((c < cycles - 1)); then
      for ((i=len; i>0; i--)); do
        local typed="${full:0:$((i-1))}"
        local name_len=${#name}
        if ((i-1 <= 0)); then
          printf "\r\033[K  ${DIM}>${NC} ${BOLD}${YELLOW}hey summon${NC} "
        elif ((i-1 <= name_len)); then
          printf "\r\033[K  ${DIM}>${NC} ${BOLD}${YELLOW}hey summon${NC} ${BOLD}%s${NC}" "$typed"
        else
          printf "\r\033[K  ${DIM}>${NC} ${BOLD}${YELLOW}hey summon${NC} ${BOLD}%s${NC} ${DIM}%s${NC}" "$name" "${typed:$((name_len+1))}"
        fi
        sleep 0.01
      done
      sleep 0.3
    fi
  done

  echo ""
  echo ""
}

print_banner
animate_taglines

# ── Checks ───────────────────────────────────────────

command -v node >/dev/null 2>&1 || die "Node.js is not installed. See https://nodejs.org"
command -v pnpm >/dev/null 2>&1 || die "pnpm is not installed. Run: npm i -g pnpm@latest"

NODE_VERSION=$(node -v | sed 's/v//' | cut -d. -f1)
if (( NODE_VERSION < 18 )); then
  die "Node.js 18+ required (found v${NODE_VERSION})"
fi

# ── Install dependencies ─────────────────────────────

if [[ ! -d node_modules ]] || [[ ! -f node_modules/.pnpm/lock.yaml ]]; then
  info "Installing dependencies..."
  pnpm install
  ok "Dependencies installed"
else
  ok "Dependencies already installed"
fi

# ── Setup wizard ─────────────────────────────────────

CONFIGURED_PORT="3425"
CONFIGURED_PROFILE="direct"
CONFIGURED_URL=""

if [[ -f .env.local ]]; then
  warn ".env.local already exists -- skipping setup wizard (delete it to re-run)"
else
  step "Setup Wizard"
  echo ""

  # ── Step 1: Port ──────────────────────────────────

  read -rp "Port for the dev server [3425]: " port_input
  CONFIGURED_PORT="${port_input:-3425}"
  echo ""

  # ── Step 2: Public Access ─────────────────────────

  echo -e "${BOLD}Public Access${NC}"
  echo ""
  echo -e "  HeySummon can work in two modes:"
  echo ""
  echo -e "  ${BOLD}Local only${NC} ${DIM}(default)${NC}"
  echo -e "  Perfect if you use ${BOLD}OpenClaw${NC} as your expert channel."
  echo -e "  AI agents poll HeySummon directly — no public URL needed."
  echo ""
  echo -e "  ${BOLD}Publicly accessible${NC}"
  echo -e "  Required if you want to receive notifications via ${BOLD}Telegram${NC} or ${BOLD}Slack${NC}."
  echo -e "  These services need to send webhooks to your machine, which means"
  echo -e "  HeySummon must be reachable over the internet via HTTPS."
  echo ""

  # Detect available tunnel tools
  HAS_TAILSCALE=false
  HAS_CLOUDFLARED=false
  command -v tailscale  >/dev/null 2>&1 && HAS_TAILSCALE=true
  command -v cloudflared >/dev/null 2>&1 && HAS_CLOUDFLARED=true

  echo -e "  How should your instance be accessible?"
  echo ""
  echo -e "  ${BOLD}1)${NC} Local only (default) — localhost:${CONFIGURED_PORT}, no tunnel"

  if [[ "$HAS_TAILSCALE" == "true" ]]; then
    echo -e "  ${BOLD}2)${NC} Tailscale Funnel ${GREEN}(detected)${NC} — persistent HTTPS via your Tailscale account"
  else
    echo -e "  ${DIM}2) Tailscale Funnel (not installed — https://tailscale.com/download)${NC}"
  fi

  if [[ "$HAS_CLOUDFLARED" == "true" ]]; then
    echo -e "  ${BOLD}3)${NC} Cloudflare Quick Tunnel ${GREEN}(detected)${NC} — temporary HTTPS, no account needed"
  else
    echo -e "  ${DIM}3) Cloudflare Quick Tunnel (not installed — https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/)${NC}"
  fi

  echo ""
  read -rp "Choose [1]: " profile_choice

  case "${profile_choice:-1}" in
    2)
      if [[ "$HAS_TAILSCALE" != "true" ]]; then
        warn "Tailscale is not installed. Falling back to local only."
        warn "Install it from https://tailscale.com/download and re-run this script."
        CONFIGURED_PROFILE="direct"
      else
        CONFIGURED_PROFILE="tailscale"
      fi
      ;;
    3)
      if [[ "$HAS_CLOUDFLARED" != "true" ]]; then
        warn "cloudflared is not installed. Falling back to local only."
        warn "Install it from https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/ and re-run this script."
        CONFIGURED_PROFILE="direct"
      else
        CONFIGURED_PROFILE="cloudflared"
      fi
      ;;
    *)
      CONFIGURED_PROFILE="direct"
      ;;
  esac
  echo ""

  # ── Start tunnel (if selected) ────────────────────

  if [[ "$CONFIGURED_PROFILE" == "tailscale" ]]; then
    info "Starting Tailscale Funnel on port ${CONFIGURED_PORT}..."

    # Check if operator permissions are set up
    if ! tailscale funnel status 2>&1 | grep -q "Funnel on" && \
       tailscale funnel status 2>&1 | grep -qiE "permission denied|operator|not allowed"; then
      echo ""
      warn "Tailscale needs operator permissions to run Funnel."
      echo -e "  Run this once and then re-run the installer:"
      echo ""
      echo -e "    ${BOLD}sudo tailscale set --operator=\$USER${NC}"
      echo ""
      CONFIGURED_PROFILE="direct"
    else
      # Start the funnel (persistent — survives restarts)
      tailscale funnel --bg "${CONFIGURED_PORT}" 2>/dev/null || true

      # Get the public hostname
      TS_HOSTNAME=$(tailscale status --json 2>/dev/null | node -e "
        let d=''; process.stdin.on('data',c=>d+=c); process.stdin.on('end',()=>{
          try { const n=JSON.parse(d).Self.DNSName.replace(/\.$/,'');
            console.log('https://'+n); } catch { process.exit(1); }
        })
      " 2>/dev/null) || true

      if [[ -n "$TS_HOSTNAME" ]]; then
        CONFIGURED_URL="$TS_HOSTNAME"
        ok "Tailscale Funnel active: ${CONFIGURED_URL}"
      else
        warn "Funnel started but could not determine hostname."
        warn "The onboarding wizard will detect it when you start the app."
        CONFIGURED_URL=""
      fi
    fi
  fi

  if [[ "$CONFIGURED_PROFILE" == "cloudflared" ]]; then
    info "Starting Cloudflare Quick Tunnel on port ${CONFIGURED_PORT}..."
    echo -e "  ${DIM}(This creates a temporary HTTPS URL — it changes each time cloudflared restarts)${NC}"

    # Kill any existing cloudflared tunnel
    pkill -f 'cloudflared tunnel' 2>/dev/null || true

    CF_LOG="/tmp/heysummon-cloudflared.log"
    rm -f "$CF_LOG"

    # Start in background
    nohup cloudflared tunnel --url "http://localhost:${CONFIGURED_PORT}" --no-autoupdate > "$CF_LOG" 2>&1 &

    # Poll for the assigned URL (up to 15 seconds)
    CF_URL=""
    for i in $(seq 1 30); do
      sleep 0.5
      if [[ -f "$CF_LOG" ]]; then
        CF_URL=$(grep -oE 'https://[a-z0-9-]+\.trycloudflare\.com' "$CF_LOG" | head -1) || true
        if [[ -n "$CF_URL" ]]; then
          break
        fi
      fi
    done

    if [[ -n "$CF_URL" ]]; then
      CONFIGURED_URL="$CF_URL"
      ok "Cloudflare Tunnel active: ${CONFIGURED_URL}"
      echo ""
      echo -e "  ${YELLOW}!${NC}  This URL is temporary. If cloudflared stops, start a new tunnel"
      echo -e "     from the HeySummon dashboard (Settings > Public Access) or re-run"
      echo -e "     this installer."
    else
      warn "Could not obtain a Cloudflare tunnel URL."
      warn "You can start the tunnel later from the dashboard (Settings > Public Access)."
      CONFIGURED_PROFILE="direct"
      pkill -f 'cloudflared tunnel' 2>/dev/null || true
    fi
    echo ""
  fi

  if [[ "$CONFIGURED_PROFILE" == "direct" ]]; then
    CONFIGURED_URL="http://localhost:${CONFIGURED_PORT}"
  fi

  # ── Generate secrets ──────────────────────────────

  info "Generating secrets..."

  if command -v openssl >/dev/null 2>&1; then
    NEXTAUTH_SECRET=$(openssl rand -hex 32)
  else
    NEXTAUTH_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
  fi

  # ── Write .env.local ──────────────────────────────

  PUBLIC_URL_LINE="HEYSUMMON_PUBLIC_URL=${CONFIGURED_URL}"

  cat > .env.local <<EOF
# HeySummon -- generated by install-local-dev.sh on $(date -Iseconds)

# ─── Required secrets (auto-generated) ──────────────
NEXTAUTH_SECRET=${NEXTAUTH_SECRET}

# ─── URLs ───────────────────────────────────────────
NEXTAUTH_URL=${CONFIGURED_URL}
${PUBLIC_URL_LINE}

# ─── Port ───────────────────────────────────────────
PORT=${CONFIGURED_PORT}

# ─── Auth ───────────────────────────────────────────
# Form login is enabled by default. No OAuth needed.
ENABLE_FORM_LOGIN=true

# Allow multiple users to register (default: only first user)
# ALLOW_REGISTRATION=true

# ─── Edition ────────────────────────────────────────
HEYSUMMON_EDITION=community
EOF

  ok ".env.local created with generated secrets"
fi

# ── Write .env (Prisma reads .env only, not .env.local) ──

if [[ ! -f .env ]]; then
  cat > .env <<EOF
# Prisma requires DATABASE_URL in .env (it does not read .env.local)
DATABASE_URL=file:./heysummon.db
EOF
  ok ".env created with DATABASE_URL for Prisma"
fi

# ── Database ─────────────────────────────────────────

if [[ -f prisma/heysummon.db ]]; then
  ok "Database already exists (prisma/heysummon.db)"
  echo ""
  echo -e "  ${YELLOW}!${NC}  To start completely fresh, remove the database and re-run:"
  echo ""
  echo -e "     ${BOLD}rm prisma/heysummon.db${NC}       # delete the database"
  echo -e "     ${BOLD}rm .env.local${NC}               # reset configuration"
  echo -e "     ${BOLD}bash install-local-dev.sh${NC}   # re-run the setup wizard"
  echo ""
  info "Running migrations on existing database..."
else
  info "Creating database..."
fi
pnpm exec prisma migrate dev --skip-generate 2>&1 | grep -E "^(Applying|Your database|SQLite)" || true
pnpm exec prisma generate 2>&1 | grep -E "Generated" || true
ok "Database ready"

# ── Done ─────────────────────────────────────────────

echo ""
echo -e "  ${GREEN}${BOLD}Setup complete!${NC}"
echo ""
echo -e "  ${DIM}|${NC}"
echo -e "  ${DIM}|${NC}  Start the dev server:  ${BOLD}pnpm dev${NC}"

# Show the right URL based on connectivity profile
if [[ -n "${CONFIGURED_URL:-}" && "${CONFIGURED_URL:-}" != "http://localhost:"* ]]; then
  echo -e "  ${DIM}|${NC}  Dashboard:             ${BOLD}${CONFIGURED_URL}${NC}"
  echo -e "  ${DIM}|${NC}  Local URL:             http://localhost:${CONFIGURED_PORT:-3425}"
else
  echo -e "  ${DIM}|${NC}  Dashboard:             ${BOLD}http://localhost:${CONFIGURED_PORT:-3425}${NC}"
fi

echo -e "  ${DIM}|${NC}"
echo -e "  ${DIM}|${NC}  ${DIM}The first user to sign up becomes the admin.${NC}"

if [[ "${CONFIGURED_PROFILE:-direct}" == "direct" ]]; then
  echo -e "  ${DIM}|${NC}"
  echo -e "  ${DIM}|${NC}  ${DIM}You chose local-only mode. To use Telegram or Slack later,${NC}"
  echo -e "  ${DIM}|${NC}  ${DIM}enable a tunnel from the dashboard or re-run this installer.${NC}"
fi

echo -e "  ${DIM}|${NC}"
echo ""
