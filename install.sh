#!/usr/bin/env bash
set -euo pipefail

# HeySummon — Self-Hosting Installer
# ------------------------------------
# Downloads docker-compose.yml, generates required secrets, and starts HeySummon.
#
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/thomasansems/heysummon/main/install.sh | bash
#
# Or download and run:
#   curl -O https://raw.githubusercontent.com/thomasansems/heysummon/main/install.sh
#   bash install.sh

BLUE='\033[0;34m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'
BOLD='\033[1m'; DIM='\033[2m'; NC='\033[0m'

info() { echo -e "  ${DIM}.${NC} $*"; }
ok()   { echo -e "  ${GREEN}.${NC} $*"; }
warn() { echo -e "  ${YELLOW}.${NC} $*"; }
die()  { echo -e "  ${RED}.${NC} $*" >&2; exit 1; }
step() { echo -e "  ${GREEN}>${NC} ${BOLD}$*${NC}"; }

REPO_RAW="https://raw.githubusercontent.com/thomasansems/heysummon/main"
INSTALL_DIR="${HEYSUMMON_DIR:-$HOME/.heysummon-docker}"

# ── Branded banner ──────────────────────────────────

SUMMON_LINES=(
  "Thomas|About to delete 847 prod records. You sure about that?"
  "Sarah|Found a \$200 cheaper flight. It leaves at 4:47 AM though."
  "Mark|Email draft says 'As per my last email'. Send it like that?"
  "Lisa|New vendor invoice: \$2,400. Never seen this account before."
  "James|Ad budget is gone. Pause everything or throw in another \$500?"
  "Anna|That PR has 6 major issues. Post the honest review or sugarcoat it?"
  "Thomas|You said 'update the homepage'. I have 4 interpretations of that."
  "Lisa|'Make it faster' -- load time, response time, or vibes?"
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
  echo -e "  ${DIM}AI does the work. Humans make the calls. Self-Hosted Human-in-the-loop${NC}"
  echo ""
}

# Typewriter animation -- 2 cycles, pure bash
animate_taglines() {
  # Skip animation in non-interactive or CI environments
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
  # Fisher-Yates shuffle
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

    # Type forward
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

    # Erase backwards (skip on last cycle)
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

command -v docker >/dev/null 2>&1 || die "Docker is not installed. See https://docs.docker.com/get-docker/"
docker compose version >/dev/null 2>&1 || die "Docker Compose v2 is required. See https://docs.docker.com/compose/install/"
command -v openssl >/dev/null 2>&1 || die "openssl is required but not found."

# ── Install directory ────────────────────────────────

mkdir -p "$INSTALL_DIR"
cd "$INSTALL_DIR"
info "Installing into: $INSTALL_DIR"

# ── Download compose file ────────────────────────────

if [[ -f docker-compose.yml ]]; then
  warn "docker-compose.yml already exists — skipping download (delete it to re-download)"
else
  info "Downloading docker-compose.yml..."
  curl -fsSL "$REPO_RAW/docker-compose.yml" -o docker-compose.yml
  ok "docker-compose.yml downloaded"
fi

if [[ -f Caddyfile ]]; then
  info "Caddyfile already exists — leaving it alone"
else
  info "Downloading Caddyfile..."
  curl -fsSL "$REPO_RAW/Caddyfile" -o Caddyfile
  ok "Caddyfile downloaded"
fi

# ── Setup wizard ─────────────────────────────────────

CONFIGURED_URL=""
CONFIGURED_PROFILE="direct"
CONFIGURED_PORT="3445"
TUNNEL_TOKEN_VALUE=""
TAILSCALE_KEY_VALUE=""
CADDY_DOMAIN=""

wizard() {
  if [[ "${HEYSUMMON_NONINTERACTIVE:-0}" == "1" ]]; then
    CONFIGURED_URL="${HEYSUMMON_URL:-}"
    CONFIGURED_PROFILE="${HEYSUMMON_PROFILE:-direct}"
    CONFIGURED_PORT="${HEYSUMMON_PORT:-3445}"
    TUNNEL_TOKEN_VALUE="${CLOUDFLARE_TUNNEL_TOKEN:-}"
    TAILSCALE_KEY_VALUE="${TAILSCALE_AUTHKEY:-}"
    CADDY_DOMAIN="${DOMAIN:-}"
    if [[ "$CONFIGURED_PROFILE" == "caddy" && -n "$CADDY_DOMAIN" && -z "$CONFIGURED_URL" ]]; then
      CONFIGURED_URL="https://${CADDY_DOMAIN}"
    fi
    # Auto-detect public IP when no URL provided in non-interactive mode
    if [[ -z "$CONFIGURED_URL" ]]; then
      DETECTED_IP=""
      imds_token=$(curl -fsSL --connect-timeout 2 -X PUT \
        -H "X-aws-ec2-metadata-token-ttl-seconds: 10" \
        "http://169.254.169.254/latest/api/token" 2>/dev/null || true)
      if [[ -n "$imds_token" ]]; then
        DETECTED_IP=$(curl -fsSL --connect-timeout 2 \
          -H "X-aws-ec2-metadata-token: $imds_token" \
          "http://169.254.169.254/latest/meta-data/public-ipv4" 2>/dev/null || true)
      fi
      if [[ -z "$DETECTED_IP" ]]; then
        DETECTED_IP=$(curl -fsSL --connect-timeout 3 "https://ifconfig.me" 2>/dev/null || true)
      fi
      if [[ -n "$DETECTED_IP" && "$DETECTED_IP" != *"<"* ]]; then
        CONFIGURED_URL="http://${DETECTED_IP}:${CONFIGURED_PORT}"
        info "Auto-detected URL: ${CONFIGURED_URL}"
      fi
    fi
    return
  fi

  step "Setup Wizard"
  echo ""

  # ── 1. Connectivity profile ────────────────────────
  echo -e "How will users access this instance?"
  echo ""
  echo -e "  ${BOLD}1)${NC} ${BOLD}Direct${NC}            ${DIM}-- expose a port, e.g. http://1.2.3.4:3445${NC}"
  echo -e "                       ${DIM}Easiest to test, no domain needed.${NC}"
  echo ""
  echo -e "  ${BOLD}2)${NC} ${BOLD}Caddy + HTTPS${NC}     ${DIM}-- automatic Let's Encrypt cert on your domain${NC}"
  echo -e "                       ${DIM}Recommended for production. Requires a domain.${NC}"
  echo ""
  echo -e "  ${BOLD}3)${NC} ${BOLD}Cloudflare Tunnel${NC} ${DIM}-- public URL via Cloudflare, no open ports${NC}"
  echo -e "                       ${DIM}Great if you already use Cloudflare DNS.${NC}"
  echo ""
  echo -e "  ${BOLD}4)${NC} ${BOLD}Tailscale Funnel${NC}  ${DIM}-- public URL via Tailscale, no domain${NC}"
  echo -e "                       ${DIM}Free, gives you a *.ts.net subdomain.${NC}"
  echo ""
  read -rp "Choose [1]: " profile_choice < /dev/tty
  echo ""

  case "${profile_choice:-1}" in
    2)
      CONFIGURED_PROFILE="caddy"
      configure_caddy
      ;;
    3)
      CONFIGURED_PROFILE="cloudflare"
      read -rp "Cloudflare Tunnel token: " TUNNEL_TOKEN_VALUE < /dev/tty
      echo ""
      ;;
    4)
      CONFIGURED_PROFILE="tailscale"
      read -rp "Tailscale auth key: " TAILSCALE_KEY_VALUE < /dev/tty
      echo ""
      ;;
    *)
      CONFIGURED_PROFILE="direct"
      configure_direct
      ;;
  esac
}

# ── Direct: ask for port + URL, with EC2/IP auto-detection ──
configure_direct() {
  read -rp "Port to expose HeySummon on [3445]: " port_input < /dev/tty
  CONFIGURED_PORT="${port_input:-3445}"
  echo ""

  echo -e "Public URL for your HeySummon instance (leave empty for auto-detection)"
  echo -e "  Examples: ${BLUE}http://52.59.33.60:${CONFIGURED_PORT}${NC}, ${BLUE}https://heysummon.example.com${NC}"
  read -rp "> " CONFIGURED_URL < /dev/tty
  echo ""

  if [[ -z "$CONFIGURED_URL" ]]; then
    DETECTED_IP=""
    # Try AWS EC2 instance metadata (IMDSv2)
    imds_token=$(curl -fsSL --connect-timeout 2 -X PUT \
      -H "X-aws-ec2-metadata-token-ttl-seconds: 10" \
      "http://169.254.169.254/latest/api/token" 2>/dev/null || true)
    if [[ -n "$imds_token" ]]; then
      DETECTED_IP=$(curl -fsSL --connect-timeout 2 \
        -H "X-aws-ec2-metadata-token: $imds_token" \
        "http://169.254.169.254/latest/meta-data/public-ipv4" 2>/dev/null || true)
    fi
    if [[ -z "$DETECTED_IP" ]]; then
      DETECTED_IP=$(curl -fsSL --connect-timeout 3 "https://ifconfig.me" 2>/dev/null || true)
    fi
    if [[ -n "$DETECTED_IP" && "$DETECTED_IP" != *"<"* ]]; then
      CONFIGURED_URL="http://${DETECTED_IP}:${CONFIGURED_PORT}"
      ok "Using auto-detected URL: ${BOLD}${CONFIGURED_URL}${NC}"
      echo ""
    fi
  fi
}

# ── Caddy: explain, ask domain, show DNS instructions, wait for confirmation ──
configure_caddy() {
  echo -e "  ${BOLD}Caddy + automatic HTTPS${NC}"
  echo ""
  echo -e "  ${DIM}Caddy is a tiny reverse proxy that sits in front of HeySummon.${NC}"
  echo -e "  ${DIM}It will obtain a real Let's Encrypt certificate for your domain${NC}"
  echo -e "  ${DIM}automatically and renew it forever -- no certbot, no cron jobs.${NC}"
  echo ""
  echo -e "  ${BOLD}Before continuing you need:${NC}"
  echo -e "    ${DIM}1.${NC} A domain name you control (e.g. ${BLUE}example.com${NC})"
  echo -e "    ${DIM}2.${NC} Access to its DNS settings (Namecheap, Cloudflare, GoDaddy, etc.)"
  echo -e "    ${DIM}3.${NC} Inbound TCP ports ${BOLD}80${NC} and ${BOLD}443${NC} open on this server"
  echo ""

  # Detect public IP so we can show it in the DNS instructions
  DETECTED_IP=""
  imds_token=$(curl -fsSL --connect-timeout 2 -X PUT \
    -H "X-aws-ec2-metadata-token-ttl-seconds: 10" \
    "http://169.254.169.254/latest/api/token" 2>/dev/null || true)
  if [[ -n "$imds_token" ]]; then
    DETECTED_IP=$(curl -fsSL --connect-timeout 2 \
      -H "X-aws-ec2-metadata-token: $imds_token" \
      "http://169.254.169.254/latest/meta-data/public-ipv4" 2>/dev/null || true)
  fi
  if [[ -z "$DETECTED_IP" ]]; then
    DETECTED_IP=$(curl -fsSL --connect-timeout 3 "https://ifconfig.me" 2>/dev/null || true)
  fi
  if [[ -n "$DETECTED_IP" && "$DETECTED_IP" == *"<"* ]]; then
    DETECTED_IP=""
  fi

  # Ask for the domain
  while [[ -z "$CADDY_DOMAIN" ]]; do
    echo -e "Which domain (or subdomain) should HeySummon be served on?"
    echo -e "  ${DIM}Examples:${NC} ${BLUE}heysummon.example.com${NC}  ${DIM}or${NC}  ${BLUE}summon.mycompany.io${NC}"
    read -rp "> " CADDY_DOMAIN < /dev/tty
    if [[ -z "$CADDY_DOMAIN" ]]; then
      warn "Domain is required for HTTPS via Caddy."
    fi
  done
  echo ""

  # Show the exact DNS record to add
  step "Add this DNS record at your registrar"
  echo ""
  echo -e "  +-------+-------------------------+----------------------+-------+"
  printf "  | %-5s | %-23s | %-20s | %-5s |\n" "Type" "Name / Host" "Value / Points to" "TTL"
  echo -e "  +-------+-------------------------+----------------------+-------+"
  # Split domain into subdomain + apex for the "Name" hint
  DNS_HOST_HINT="$CADDY_DOMAIN"
  IFS='.' read -ra DPARTS <<< "$CADDY_DOMAIN"
  if [[ ${#DPARTS[@]} -gt 2 ]]; then
    DNS_HOST_HINT="${DPARTS[0]}"
  else
    DNS_HOST_HINT="@"
  fi
  printf "  | %-5s | %-23s | %-20s | %-5s |\n" "A" "$DNS_HOST_HINT" "${DETECTED_IP:-<your server IP>}" "300"
  echo -e "  +-------+-------------------------+----------------------+-------+"
  echo ""
  echo -e "  ${DIM}Notes:${NC}"
  echo -e "  ${DIM}-${NC} Most registrars want only the subdomain in 'Name'. If yours wants${NC}"
  echo -e "    ${DIM}the full hostname, enter ${BOLD}${CADDY_DOMAIN}${NC}${DIM} instead.${NC}"
  echo -e "  ${DIM}-${NC} On AWS EC2, give your instance an ${BOLD}Elastic IP${NC} so it survives reboots."
  echo -e "  ${DIM}-${NC} Verify with: ${BOLD}dig +short ${CADDY_DOMAIN}${NC}"
  echo ""

  # Wait for the user to confirm DNS is set
  while true; do
    read -rp "Have you added the DNS record above? [y/N]: " dns_confirm < /dev/tty
    case "${dns_confirm,,}" in
      y|yes) break ;;
      *)
        warn "Caddy will fail to obtain a certificate without the DNS record."
        warn "Add it now (propagation usually takes 1-5 minutes), then continue."
        echo ""
        ;;
    esac
  done
  echo ""

  # Optional pre-flight DNS check
  if command -v dig >/dev/null 2>&1; then
    info "Checking DNS resolution for ${BOLD}${CADDY_DOMAIN}${NC}..."
    RESOLVED_IP=$(dig +short +time=3 +tries=1 "$CADDY_DOMAIN" A | tail -n1)
    if [[ -z "$RESOLVED_IP" ]]; then
      warn "DNS does not resolve yet. Caddy will retry until it does."
    elif [[ -n "$DETECTED_IP" && "$RESOLVED_IP" != "$DETECTED_IP" ]]; then
      warn "DNS resolves to ${RESOLVED_IP} but this server appears to be ${DETECTED_IP}."
      warn "Double-check your A-record before continuing."
    else
      ok "DNS resolves to ${BOLD}${RESOLVED_IP}${NC}"
    fi
    echo ""
  fi

  CONFIGURED_URL="https://${CADDY_DOMAIN}"
  CONFIGURED_PORT="3445"  # internal only, not exposed
}

# ── Generate .env ────────────────────────────────────

if [[ -f .env ]]; then
  warn ".env already exists -- skipping secret generation (delete it to regenerate)"
else
  wizard

  info "Generating secrets and writing .env..."

  NEXTAUTH_SECRET=$(openssl rand -hex 32)
  DB_PASSWORD=$(openssl rand -hex 16)

  cat > .env <<EOF
# HeySummon -- generated by installer on $(date -Iseconds)
# Edit this file to configure OAuth, tunnels, or change the public URL.

# ─── Required secrets (auto-generated) ──────────────
NEXTAUTH_SECRET=${NEXTAUTH_SECRET}

# ─── Database ───────────────────────────────────────
DB_USER=heysummon
DB_PASSWORD=${DB_PASSWORD}
DB_NAME=heysummon

# ─── URLs ───────────────────────────────────────────
# Public URL (optional). Leave empty for auto-detection via AUTH_TRUST_HOST.
# Set this if using a tunnel or custom domain.
NEXTAUTH_URL=${CONFIGURED_URL}
HEYSUMMON_PUBLIC_URL=${CONFIGURED_URL}

# ─── Port ───────────────────────────────────────────
PORT=${CONFIGURED_PORT}

# ─── Auth ───────────────────────────────────────────
# Form login is enabled by default. No OAuth needed.
# ALLOW_REGISTRATION=true    # uncomment to allow more than one user to register

# ─── Reverse proxy / HTTPS (optional, --profile caddy) ──
# Domain to serve HeySummon on. Caddy will automatically obtain a
# Let's Encrypt certificate for this domain on first start.
DOMAIN=${CADDY_DOMAIN}

# ─── Tunnels (optional) ─────────────────────────────
CLOUDFLARE_TUNNEL_TOKEN=${TUNNEL_TOKEN_VALUE}
TAILSCALE_AUTHKEY=${TAILSCALE_KEY_VALUE}
EOF

  ok ".env created with generated secrets"
fi

# ── Start ────────────────────────────────────────────

echo ""
step "Starting HeySummon"
case "$CONFIGURED_PROFILE" in
  caddy)
    docker compose --profile caddy up -d
    ;;
  cloudflare)
    docker compose --profile cloudflare up -d
    ;;
  tailscale)
    docker compose --profile tailscale up -d
    ;;
  *)
    docker compose up -d
    ;;
esac

# ── Caddy: tail logs briefly so the user can see cert acquisition ──
if [[ "$CONFIGURED_PROFILE" == "caddy" ]]; then
  echo ""
  info "Waiting for Caddy to obtain a Let's Encrypt certificate..."
  info "(This usually takes 10-30 seconds. Press Ctrl+C any time to skip.)"
  echo ""
  # Try for up to 60s — return as soon as we see "certificate obtained"
  obtained=0
  for _ in $(seq 1 30); do
    if docker compose logs caddy 2>/dev/null | grep -q "certificate obtained successfully"; then
      ok "Certificate obtained for ${BOLD}${CADDY_DOMAIN}${NC}"
      obtained=1
      break
    fi
    sleep 2
  done
  if [[ "$obtained" == "0" ]]; then
    warn "Caddy is still working on the certificate. Tail logs with:"
    warn "  ${BOLD}docker compose --profile caddy logs -f caddy${NC}"
  fi
  echo ""
fi

# ── Verify public access (non-blocking) ──────────────

if [[ -n "$CONFIGURED_URL" ]]; then
  info "Verifying public access..."
  sleep 5
  if curl -fsSL --max-time 10 "${CONFIGURED_URL}/api/v1/health" >/dev/null 2>&1; then
    ok "Public access verified: ${CONFIGURED_URL}"
  else
    warn "Could not reach ${CONFIGURED_URL}/api/v1/health yet."
    warn "Caddy may still be obtaining a certificate, or DNS may need a few minutes."
    warn "Tail logs with: ${BOLD}docker compose logs -f${NC}"
  fi
fi

echo ""
echo -e "  ${GREEN}${BOLD}HeySummon is running!${NC}"
echo ""
echo -e "  ${DIM}|${NC}"
echo -e "  ${DIM}|${NC}  Dashboard:  ${BOLD}${CONFIGURED_URL:-http://<your-server-ip>:${CONFIGURED_PORT:-3445}}${NC}"
echo -e "  ${DIM}|${NC}  .env:       ${BOLD}${INSTALL_DIR}/.env${NC}"
echo -e "  ${DIM}|${NC}"
echo -e "  ${DIM}|${NC}  ${DIM}The first user to sign up becomes the admin.${NC}"
if [[ "$CONFIGURED_PROFILE" == "direct" ]]; then
  echo -e "  ${DIM}|${NC}"
  echo -e "  ${DIM}|${NC}  ${DIM}To add HTTPS on your own domain later:${NC}"
  echo -e "  ${DIM}|${NC}    ${BOLD}DOMAIN=heysummon.example.com${NC} in .env, then"
  echo -e "  ${DIM}|${NC}    ${BOLD}docker compose --profile caddy up -d${NC}     ${DIM}(automatic Let's Encrypt)${NC}"
  echo -e "  ${DIM}|${NC}"
  echo -e "  ${DIM}|${NC}  ${DIM}Or via a tunnel (no domain needed):${NC}"
  echo -e "  ${DIM}|${NC}    ${BOLD}docker compose --profile cloudflare up -d${NC}  ${DIM}(Cloudflare)${NC}"
  echo -e "  ${DIM}|${NC}    ${BOLD}docker compose --profile tailscale up -d${NC}   ${DIM}(Tailscale)${NC}"
fi
if [[ "$CONFIGURED_PROFILE" == "caddy" ]]; then
  echo -e "  ${DIM}|${NC}"
  echo -e "  ${DIM}|${NC}  ${DIM}Caddy is handling automatic HTTPS for ${BOLD}${CADDY_DOMAIN}${NC}${DIM}.${NC}"
  echo -e "  ${DIM}|${NC}  ${DIM}It will renew the certificate automatically every 60 days.${NC}"
  echo -e "  ${DIM}|${NC}  ${DIM}Caddy logs:${NC} ${BOLD}docker compose --profile caddy logs -f caddy${NC}"
fi
echo -e "  ${DIM}|${NC}"
echo -e "  ${DIM}|${NC}  Stop:   ${BOLD}docker compose down${NC}"
echo -e "  ${DIM}|${NC}  Update: ${BOLD}docker compose pull && docker compose up -d${NC}"
echo -e "  ${DIM}|${NC}"
echo ""
