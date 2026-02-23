# Self-Hosting HeySummon

Complete guide to running your own HeySummon instance.

## Prerequisites

- **Docker** ≥ 24.0 with **Docker Compose** plugin
- A machine with ≥ 1 GB RAM (works on Raspberry Pi 4+)
- (Optional) An account with a tunnel provider for public access

---

## Option 1: Quick Start — Without Docker

Best for **development** or trying HeySummon locally.

```bash
git clone https://github.com/thomasansems/heysummon.git
cd heysummon
npm install
cp .env.example .env.local   # edit with your credentials
npx prisma generate && npx prisma db push
npx prisma db seed            # optional: sample data
npm run dev
```

The app is available at `http://localhost:3000`. This runs without Guard — suitable for local development only.

---

## Option 2: Docker (Recommended for Production)

One command deploys the full stack: **Guard** (reverse proxy with Ed25519 signing), **Platform**, **Postgres**, and **Mercure** (real-time events).

### Architecture

All external traffic flows through Guard. The Platform is **never** directly exposed:

```
Internet → [Tunnel] → Guard (:3000) → Platform (internal only)
                                    → Mercure (internal only)
                                    → Postgres (internal only)
```

### Basic Setup (Local Only)

```bash
git clone https://github.com/thomasansems/heysummon.git
cd heysummon
cp .env.example .env          # edit secrets
docker compose up -d
```

This starts HeySummon on `http://localhost:3000` via Guard. Ed25519 keys are auto-generated on first boot.

### Required Environment Variables

| Variable | Description | Example |
|---|---|---|
| `NEXTAUTH_SECRET` | Random secret for session encryption | `openssl rand -base64 32` |
| `MERCURE_JWT_SECRET` | JWT secret for Mercure pub/sub | `openssl rand -base64 32` |
| `DB_PASSWORD` | Postgres password (default: `heysummon_dev`) | `openssl rand -base64 24` |
| `NEXTAUTH_URL` | Public URL of your instance | `https://heysummon.yourdomain.com` |
| `HEYSUMMON_PUBLIC_URL` | Same as above, used for links in notifications | `https://heysummon.yourdomain.com` |

---

## Making HeySummon Public

To let AI agents reach your instance from the internet, you need a tunnel. HeySummon includes built-in Docker Compose profiles for three options:

| Feature | Cloudflare Tunnel | Tailscale Funnel | Ngrok |
|---|---|---|---|
| **Cost** | Free | Free | Free (limited) |
| **Custom domain** | ✅ Yes | ❌ `*.ts.net` only | ✅ Paid plans |
| **Stable URL** | ✅ | ✅ | ❌ Changes on restart (free) |
| **TLS** | ✅ Auto | ✅ Auto | ✅ Auto |
| **Setup difficulty** | Medium | Easy | Easy |
| **Best for** | Production | Internal/team use | Quick testing |
| **Raspberry Pi** | ✅ | ✅ | ✅ |
| **DDoS protection** | ✅ | ❌ | ❌ |

> **Important:** All tunnel profiles route traffic through **Guard**, not directly to the Platform. This ensures every request is validated and signed.

---

<details>
<summary><h3>🟠 Cloudflare Tunnel (Recommended for Production)</h3></summary>

Best for production: free, stable custom domain, DDoS protection, no open ports.

#### Setup

1. Go to [Cloudflare Zero Trust](https://one.dash.cloudflare.com) → Networks → Tunnels
2. Create a tunnel, name it `heysummon`
3. Add a **public hostname** (e.g. `heysummon.yourdomain.com`)
4. Set the service to `http://heysummon-guard:3000`
5. Copy the tunnel token

#### Environment Variables

Add to your `.env`:
```bash
CLOUDFLARE_TUNNEL_TOKEN=your-tunnel-token-here
NEXTAUTH_URL=https://heysummon.yourdomain.com
HEYSUMMON_PUBLIC_URL=https://heysummon.yourdomain.com
```

#### Start

```bash
docker compose --profile cloudflare up -d
```

#### How It Works

```
Internet → Cloudflare Edge (TLS + DDoS) → cloudflared container
         → heysummon-guard:3000 (validates + signs)
         → app:3000 (Platform, internal network)
```

No inbound ports needed. Cloudflare handles TLS, DDoS, and caching.

</details>

---

<details>
<summary><h3>🔵 Tailscale Funnel</h3></summary>

Best for team/internal use: easy setup, WireGuard-based, free.

#### Setup

1. Have a [Tailscale](https://tailscale.com) account
2. Enable [Funnel in your ACL policy](https://tailscale.com/kb/1223/funnel):
   ```json
   {
     "nodeAttrs": [
       {
         "target": ["tag:heysummon"],
         "attr": ["funnel"]
       }
     ]
   }
   ```
3. Generate an [auth key](https://login.tailscale.com/admin/settings/keys) (reusable, tagged `tag:heysummon`)

#### Environment Variables

Add to your `.env`:
```bash
TAILSCALE_AUTHKEY=tskey-auth-xxxxx
NEXTAUTH_URL=https://heysummon.your-tailnet.ts.net
HEYSUMMON_PUBLIC_URL=https://heysummon.your-tailnet.ts.net
```

#### Tailscale Serve Config

Create `tailscale-config/serve.json`:
```json
{
  "TCP": {
    "443": {
      "HTTPS": true
    }
  },
  "Web": {
    "heysummon.your-tailnet.ts.net:443": {
      "Handlers": {
        "/": {
          "Proxy": "http://heysummon-guard:3000"
        }
      }
    }
  },
  "AllowFunnel": {
    "heysummon.your-tailnet.ts.net:443": true
  }
}
```

#### Start

```bash
docker compose --profile tailscale up -d
```

#### How It Works

```
Internet → Tailscale Funnel (WireGuard TLS)
         → tailscale container
         → heysummon-guard:3000 (validates + signs)
         → app:3000 (Platform, internal network)
```

</details>

---

<details>
<summary><h3>🟢 Ngrok</h3></summary>

Best for quick testing: instant public URL, zero config.

#### Setup

1. Create an account at [ngrok.com](https://ngrok.com)
2. Copy your auth token from the dashboard
3. (Optional) Set up a custom domain on a paid plan

#### Environment Variables

Add to your `.env`:
```bash
NGROK_AUTHTOKEN=your-ngrok-authtoken
# Optional: custom domain (paid plans)
# NGROK_DOMAIN=heysummon.ngrok.io
```

#### Start

```bash
docker compose --profile ngrok up -d
```

Your public URL is visible at `http://localhost:4040` (ngrok inspection UI).

> ⚠️ **Free tier:** URL changes on every restart. Not suitable for production.

#### How It Works

```
Internet → ngrok Edge (TLS)
         → ngrok container
         → heysummon-guard:3000 (validates + signs)
         → app:3000 (Platform, internal network)
```

</details>

---

<details>
<summary><h3>🟡 Local Only (No Tunnel)</h3></summary>

If you only need HeySummon on your local network (e.g. AI agents running on the same machine or LAN):

```bash
docker compose up -d
```

Access at `http://localhost:3000` or `http://<your-ip>:3000` from other machines on your network.

No tunnel container is started. Guard still validates all requests.

</details>

---

## Docker Compose Files

| File | Purpose |
|---|---|
| `docker-compose.yml` | **Main file** — Guard, Platform, Postgres, Mercure + tunnel profiles |
| `docker-compose.cloudflare.yml` | ⚠️ Legacy — use `--profile cloudflare` instead |
| `docker-compose.tailscale.yml` | ⚠️ Legacy — use `--profile tailscale` instead |
| `docker-compose.ngrok.yml` | ⚠️ Legacy — use `--profile ngrok` instead |

> The tunnel services are now integrated as **profiles** in the main `docker-compose.yml`. The separate files are kept for backward compatibility but will be removed in a future release.

## Setup Wizard

For an interactive setup experience:

```bash
bash scripts/setup.sh
```

The wizard will:
1. Ask which connectivity method you want
2. Collect the required tokens
3. Generate `.env` and start the stack

## Security Notes

- **Guard** validates every request and adds an Ed25519 signature (receipt). The Platform verifies this receipt and rejects unsigned requests.
- The **Platform** runs on an internal Docker network (`backend`) with no exposed ports.
- Ed25519 keys are auto-generated on first boot and stored in a Docker volume.
- All tunnel profiles route through Guard — the Platform is **never** directly exposed.

## Hardware Requirements

| Setup | RAM | CPU | Storage |
|---|---|---|---|
| Minimum (Raspberry Pi 4) | 1 GB | 2 cores | 2 GB |
| Recommended (VPS) | 2 GB | 2 cores | 10 GB |
| Production | 4 GB+ | 4 cores | 20 GB+ |

## Updating

```bash
cd heysummon
git pull
docker compose build
docker compose up -d
```

Database migrations run automatically on startup.
