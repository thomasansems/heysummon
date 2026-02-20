# Self-Hosting HITLaaS

Complete guide to running your own HITLaaS instance with public internet access.

## Prerequisites

- **Docker** ≥ 24.0 with **Docker Compose** plugin
- A machine with ≥ 1 GB RAM (works on Raspberry Pi 4+)
- An account with your chosen connectivity provider (or none for local-only)

## Quick Start (5 minutes)

```bash
git clone https://github.com/thomasansems/hitlaas-platform.git
cd hitlaas-platform
bash scripts/setup.sh
```

The wizard will:
1. Ask which connectivity method you want
2. Collect the required token/key
3. Generate `.env` and `docker-compose.override.yml`
4. Optionally start the stack

## Connectivity Options

| Feature | Cloudflare Tunnel | Tailscale Funnel | Ngrok |
|---|---|---|---|
| **Cost** | Free | Free | Free (limited) |
| **Custom domain** | ✅ Yes | ❌ `*.ts.net` only | ✅ Paid plans |
| **Stable URL** | ✅ | ✅ | ❌ Free changes on restart |
| **TLS** | ✅ Auto | ✅ Auto | ✅ Auto |
| **Setup difficulty** | Medium | Easy | Easy |
| **Best for** | Production | Internal/team use | Quick testing |
| **Raspberry Pi** | ✅ | ✅ | ✅ |

## Option 1: Cloudflare Tunnel (Recommended)

### Setup

1. Go to [Cloudflare Zero Trust](https://one.dash.cloudflare.com) → Networks → Tunnels
2. Create a tunnel, name it `hitlaas`
3. Add a **public hostname** (e.g. `hitlaas.yourdomain.com`) pointing to `http://app:3000`
4. Copy the tunnel token
5. Run the setup wizard and choose option 1

### How it works

Cloudflare's `cloudflared` daemon creates an outbound-only connection to Cloudflare's edge. No inbound ports need to be opened. Traffic flows:

```
Internet → Cloudflare Edge → cloudflared container → app:3000
```

### Security notes

- No open inbound ports required
- All traffic encrypted end-to-end
- DDoS protection included
- Access policies available via Cloudflare Zero Trust

## Option 2: Tailscale Funnel

### Setup

1. Install Tailscale or have a Tailscale account
2. Enable [Funnel in your ACL policy](https://tailscale.com/kb/1223/funnel)
3. Generate an [auth key](https://login.tailscale.com/admin/settings/keys) (reusable, with tags)
4. Run the setup wizard and choose option 2

### How it works

Tailscale creates a WireGuard mesh VPN. Funnel extends this to accept traffic from the public internet at `https://hitlaas.<tailnet>.ts.net`.

### Security notes

- Built on WireGuard (strong encryption)
- Funnel traffic is visible to Tailscale's infrastructure
- Can restrict to Tailscale-only access (`--serve` instead of `--funnel`)
- Auth key should be tagged and scoped

## Option 3: Ngrok

### Setup

1. Create an account at [ngrok.com](https://ngrok.com)
2. Copy your auth token from the dashboard
3. Run the setup wizard and choose option 3
4. (Optional) Set up a custom domain on a paid plan

### How it works

Ngrok creates a tunnel from its cloud to your local app. Free tier URLs are random and change on restart.

### Security notes

- Free URLs are public and guessable
- Consider adding HTTP basic auth via ngrok config for extra protection
- Paid plans offer IP restrictions and custom domains
- Inspect traffic at `http://localhost:4040`

## Option 4: Direct / Manual

Skip the tunnel and handle networking yourself. Use this if you have a VPS with a public IP, or are behind a reverse proxy like Nginx/Caddy.

```bash
# Just start without a tunnel
docker compose up -d
```

## Environment Variables Reference

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `NEXTAUTH_URL` | Yes | Public URL of your instance |
| `NEXTAUTH_SECRET` | Yes | Random secret for session encryption |
| `AUTH_GITHUB_ID` | No | GitHub OAuth app ID |
| `AUTH_GITHUB_SECRET` | No | GitHub OAuth app secret |
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
  "timestamp": "2025-01-01T00:00:00.000Z"
}
```

Used by Docker's built-in health checks. Does not expose sensitive information.

## Security Hardening Checklist

- [ ] Change `NEXTAUTH_SECRET` to a strong random value (wizard does this automatically)
- [ ] Change the default database password in `docker-compose.yml`
- [ ] Set up GitHub/Google OAuth for authentication
- [ ] Use a connectivity option with TLS (all three options provide this)
- [ ] Keep Docker and images updated (`docker compose pull && docker compose up -d`)
- [ ] Review API key permissions regularly via the Settings page
- [ ] Enable firewall — no inbound ports needed with tunnel options
- [ ] Back up your database regularly: `docker compose exec db pg_dump -U hitlaas hitlaas > backup.sql`

## Docker Image

Pre-built images are available on GHCR:

```bash
docker pull ghcr.io/thomasansems/hitlaas-platform:latest
```

Available for `linux/amd64` and `linux/arm64` (Raspberry Pi).

To use the pre-built image instead of building locally, edit `docker-compose.yml`:

```yaml
services:
  app:
    image: ghcr.io/thomasansems/hitlaas-platform:latest
    # build: .  ← comment out or remove
```

## Troubleshooting

### App won't start
```bash
docker compose logs app
```
Common causes: missing env vars, database not ready. The app waits for the DB health check.

### Tunnel not connecting
```bash
docker compose logs cloudflared  # or tailscale / ngrok
```
Check that your token/key is correct and not expired.

### Database issues
```bash
# Reset the database
docker compose down -v
docker compose up -d
```

### Health check failing
```bash
curl http://localhost:3000/api/health
```
If this works locally but not via tunnel, the tunnel configuration needs fixing.

### Ngrok URL changed
Free ngrok URLs change on restart. Check `http://localhost:4040/status` for the current URL, then update `NEXTAUTH_URL` in `.env` and restart the app.

### ARM64 / Raspberry Pi issues
Ensure you're using the multi-arch images. All recommended sidecar images support ARM64.

## Testing End-to-End

1. Start the stack: `docker compose up -d`
2. Open your public URL in a browser
3. Sign in and create an API key in Settings
4. Test the API:

```bash
curl -X POST https://your-url.com/api/v1/requests \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"title": "Test request", "description": "Testing self-hosted setup"}'
```

5. Check the dashboard for the new request
6. Respond to it and verify the response is returned
