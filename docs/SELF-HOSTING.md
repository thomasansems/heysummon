# Self-Hosting HeySummon

Complete guide to running your own HeySummon instance with public internet access.

## Architecture

All external traffic flows through the Guard reverse proxy for content safety:

```
Internet / AI Agent
        │
        ▼
┌─── Tunnel (optional) ───┐
│  Cloudflare / Tailscale  │
│  Ngrok / Direct          │
└──────────┬───────────────┘
           ▼
┌─── Guard (:3000) ───────┐   ← Single entry point (Ed25519 signing, content safety)
│  Content validation      │
│  Receipt signing         │
└──────────┬───────────────┘
           ▼
┌─── Platform (internal) ─┐   ← No external ports
│  Next.js app             │
│  ├── PostgreSQL          │
│  └── Mercure (SSE hub)   │
└──────────────────────────┘
```

The Platform is **never exposed directly**. Guard validates content, creates cryptographic receipts, and proxies to the Platform on an internal Docker network.

## Prerequisites

- **Docker** >= 24.0 with **Docker Compose** plugin
- A machine with >= 1 GB RAM (works on Raspberry Pi 4+)
- An account with your chosen connectivity provider (or none for local-only)

## Quick Start (5 minutes)

```bash
git clone https://github.com/thomasansems/heysummon-network.git
cd heysummon-network
bash scripts/setup.sh
```

The wizard will:
1. Ask which connectivity method you want
2. Collect the required token/key
3. Generate Ed25519 Guard keys (or rely on Docker auto-generation)
4. Generate `.env` and `docker-compose.override.yml`
5. Optionally start the stack
6. Optionally run a connectivity test

## Docker Compose Profiles

Each connectivity option is a Docker Compose profile. No override files needed for tunnels:

```bash
# Cloudflare Tunnel
docker compose --profile cloudflare up -d

# Tailscale Funnel
docker compose --profile tailscale up -d

# Ngrok
docker compose --profile ngrok up -d

# Local only (no tunnel)
docker compose up -d
```

All tunnel services connect to **Guard** (`heysummon-guard:3000`), not directly to Platform.

## Connectivity Options

| Feature | Cloudflare Tunnel | Tailscale Funnel | Ngrok |
|---|---|---|---|
| **Cost** | Free | Free | Free (limited) |
| **Custom domain** | Yes | No (`*.ts.net` only) | Paid plans |
| **Stable URL** | Yes | Yes | No (free changes on restart) |
| **TLS** | Auto | Auto | Auto |
| **SSE/streaming** | Works natively | Works natively | May buffer — see notes |
| **Setup difficulty** | Medium | Easy | Easy |
| **Best for** | Production | Internal/team use | Quick testing |
| **Raspberry Pi** | Yes | Yes | Yes |

## Option 1: Cloudflare Tunnel (Recommended)

### Setup

1. Go to [Cloudflare Zero Trust](https://one.dash.cloudflare.com) → Networks → Tunnels
2. Create a tunnel, name it `heysummon`
3. Add a **public hostname** (e.g. `heysummon.yourdomain.com`) pointing to `http://heysummon-guard:3000`
   > **Important**: Point to Guard, not the Platform
4. Copy the tunnel token
5. Set `CLOUDFLARE_TUNNEL_TOKEN` in `.env`

### Start

```bash
docker compose --profile cloudflare up -d
```

### How it works

```
Internet → Cloudflare Edge → cloudflared → heysummon-guard:3000 → Platform (internal)
```

Cloudflare's `cloudflared` daemon creates an outbound-only connection to Cloudflare's edge. No inbound ports need to be opened.

### Security notes

- No open inbound ports required
- All traffic encrypted end-to-end
- DDoS protection included
- Access policies available via Cloudflare Zero Trust
- SSE streams pass through without buffering

## Option 2: Tailscale Funnel

### Setup

1. Install Tailscale or have a Tailscale account
2. Enable [Funnel in your ACL policy](https://tailscale.com/kb/1223/funnel)
3. Generate an [auth key](https://login.tailscale.com/admin/settings/keys) (reusable, with tags)
4. Set `TAILSCALE_AUTHKEY` in `.env`

### Start

```bash
docker compose --profile tailscale up -d
```

### How it works

```
Internet → Tailscale Funnel → tailscale container → heysummon-guard:3000 → Platform (internal)
```

Tailscale creates a WireGuard mesh VPN. Funnel extends this to accept traffic from the public internet. The serve config in `tailscale-config/serve.json` routes all traffic to Guard.

### Security notes

- Built on WireGuard (strong encryption)
- Funnel traffic is visible to Tailscale's infrastructure
- Can restrict to Tailscale-only access (edit serve config for `--serve` instead of `--funnel`)
- Auth key should be tagged and scoped

## Option 3: Ngrok

### Setup

1. Create an account at [ngrok.com](https://ngrok.com)
2. Copy your auth token from the dashboard
3. Set `NGROK_AUTHTOKEN` in `.env`
4. (Optional) Set `NGROK_DOMAIN` for a custom domain (paid plan)

### Start

```bash
docker compose --profile ngrok up -d
```

### How it works

```
Internet → Ngrok Edge → ngrok container → heysummon-guard:3000 → Platform (internal)
```

### SSE/streaming note

Ngrok may buffer Server-Sent Events on the free tier. If you experience delayed real-time updates, consider:
- Upgrading to a paid ngrok plan
- Using Cloudflare Tunnel instead (handles SSE natively)
- Adding `ngrok http --response-header-add "X-Accel-Buffering: no"` to the ngrok command

### Security notes

- Free URLs are public and guessable
- Consider adding HTTP basic auth via ngrok config for extra protection
- Paid plans offer IP restrictions and custom domains
- Inspect traffic at `http://localhost:4040`

## Option 4: Direct / Manual

Skip the tunnel and handle networking yourself. Use this if you have a VPS with a public IP, or are behind a reverse proxy like Nginx/Caddy.

```bash
# Just start without a tunnel profile
docker compose up -d
```

Point your reverse proxy to Guard's port (`localhost:3000` by default), **not** directly to the Platform.

## Environment Variables Reference

| Variable | Required | Description |
|---|---|---|
| `NEXTAUTH_SECRET` | Yes | Random secret for session encryption |
| `MERCURE_JWT_SECRET` | Yes | Random secret for Mercure auth |
| `DATABASE_URL` | No | PostgreSQL connection string (Docker auto-configures) |
| `NEXTAUTH_URL` | Yes | Public URL of your instance |
| `HEYSUMMON_PUBLIC_URL` | No | Public URL (used by health check and API responses) |
| `AUTH_GITHUB_ID` | No | GitHub OAuth app ID |
| `AUTH_GITHUB_SECRET` | No | GitHub OAuth app secret |
| `GUARD_PORT` | No | Host port for Guard (default: 3000) |
| `REQUIRE_GUARD` | No | Enforce Guard receipt validation (default: true) |
| `CONNECTIVITY_METHOD` | No | `cloudflare`, `tailscale`, `ngrok`, or `direct` |
| `CLOUDFLARE_TUNNEL_TOKEN` | Cloudflare only | Tunnel token from dashboard |
| `TAILSCALE_AUTHKEY` | Tailscale only | Auth key for Tailscale |
| `NGROK_AUTHTOKEN` | Ngrok only | Auth token from ngrok dashboard |
| `NGROK_DOMAIN` | No | Custom ngrok domain (paid) |

## Health Check

The `/api/health` endpoint returns:

```json
{
  "status": "ok",
  "version": "0.1.0",
  "connectivity": "cloudflare",
  "publicUrl": "https://heysummon.example.com",
  "guard": {
    "enabled": true,
    "reachable": true,
    "latencyMs": 2
  },
  "timestamp": "2026-01-01T00:00:00.000Z"
}
```

Guard also has its own health check at `/health`:

```bash
# Check Guard directly
curl http://localhost:3000/health

# Check Platform through Guard
curl http://localhost:3000/api/health
```

## Security Hardening Checklist

- [ ] Change `NEXTAUTH_SECRET` to a strong random value (wizard does this automatically)
- [ ] Change `MERCURE_JWT_SECRET` to a strong random value (wizard does this automatically)
- [ ] Change the default database password in `.env`
- [ ] Set up GitHub/Google OAuth for authentication
- [ ] Use a connectivity option with TLS (all three tunnel options provide this)
- [ ] Keep Docker and images updated (`docker compose pull && docker compose up -d`)
- [ ] Review API key permissions regularly via the Settings page
- [ ] Enable firewall — no inbound ports needed with tunnel options
- [ ] Guard is always the entry point — never expose the Platform port
- [ ] Back up your database regularly: `docker compose exec db pg_dump -U heysummon heysummon > backup.sql`

## Docker Image

Pre-built images are available on GHCR:

```bash
docker pull ghcr.io/thomasansems/heysummon-network:latest
```

Available for `linux/amd64` and `linux/arm64` (Raspberry Pi).

To use the pre-built image instead of building locally, edit `docker-compose.yml`:

```yaml
services:
  app:
    image: ghcr.io/thomasansems/heysummon-network:latest
    # build: .  ← comment out or remove
```

## Troubleshooting

### App won't start
```bash
docker compose logs app
```
Common causes: missing env vars, database not ready. The app waits for the DB health check.

### Guard not connecting to Platform
```bash
docker compose logs heysummon-guard
```
Guard needs the Platform to be healthy first. Check `docker compose logs app` for startup errors.

### Tunnel not connecting
```bash
# Check the tunnel service logs for your connectivity method:
docker compose logs cloudflared   # Cloudflare
docker compose logs tailscale     # Tailscale
docker compose logs ngrok         # Ngrok
```
Check that your token/key is correct and not expired.

### SSE/real-time events not working through tunnel

Some tunnels buffer SSE responses. Symptoms: real-time notifications arrive late or in batches.

**Cloudflare Tunnel**: Handles SSE natively, no configuration needed.

**Tailscale Funnel**: Handles SSE natively.

**Ngrok**: May buffer on free tier. Workarounds:
- Check if ngrok inspector shows events flowing: `http://localhost:4040`
- Upgrade to paid ngrok plan
- Switch to Cloudflare Tunnel for production use

### Health check shows "degraded"

The health endpoint checks Guard reachability. If it shows `"status": "degraded"`:

```bash
# Verify Guard is running
docker compose ps heysummon-guard

# Check Guard health directly
curl http://localhost:3000/health

# Check Guard logs
docker compose logs heysummon-guard
```

### Database issues
```bash
# Reset the database
docker compose down -v
docker compose up -d
```

### Ngrok URL changed
Free ngrok URLs change on restart. Check `http://localhost:4040/status` for the current URL, then update `NEXTAUTH_URL` and `HEYSUMMON_PUBLIC_URL` in `.env` and restart the app.

### ARM64 / Raspberry Pi issues
Ensure you're using the multi-arch images. All recommended sidecar images support ARM64.

## Testing End-to-End

1. Start the stack: `docker compose --profile <method> up -d`
2. Check Guard health: `curl http://localhost:3000/health`
3. Check Platform health through Guard: `curl http://localhost:3000/api/health`
4. Open your public URL in a browser
5. Sign in and create an API key in Settings
6. Test the API through the tunnel:

```bash
curl -X POST https://your-url.com/api/v1/help \
  -H "x-api-key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"question": "Test request from remote network"}'
```

7. Check the dashboard for the new request
8. Verify SSE events by watching the events stream:

```bash
curl -N https://your-url.com/api/v1/events/stream \
  -H "x-api-key: YOUR_API_KEY"
```

For the full networking guide with architecture diagrams and security comparisons, see [NETWORKING.md](./NETWORKING.md).
