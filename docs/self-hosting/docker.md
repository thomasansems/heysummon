# Docker

The recommended way to self-host HeySummon. Includes the Guard proxy, Next.js platform, PostgreSQL, and Mercure.

---

## Prerequisites

- Docker 24+
- Docker Compose v2

---

## Quick start

```bash
git clone https://github.com/thomasansems/heysummon.git
cd heysummon
cp .env.example .env
```

Edit `.env` — the only required values are:

```bash
NEXTAUTH_SECRET=        # openssl rand -hex 32
NEXTAUTH_URL=           # http://localhost:3445
MERCURE_JWT_SECRET=     # openssl rand -hex 32
```

Start:

```bash
docker compose up -d
```

HeySummon is running at `http://localhost:3445`.

---

## Architecture

```
Internet
    │
    ▼
Guard (:3445)          — Ed25519 request signing, rate limiting
    │
    ▼ (internal network only)
Platform (Next.js)     — API, dashboard, auth
    │
    ├──▶ PostgreSQL     — data storage
    └──▶ Mercure        — real-time SSE hub
```

**Guard** is the single entry point. Platform has no exposed ports — it's only reachable from Guard on the internal Docker network.

---

## Using pre-built images

Use `docker-compose.prod.yml` to pull images from GHCR instead of building locally:

```bash
docker compose -f docker-compose.prod.yml up -d
```

Pin a specific version:

```bash
HEYSUMMON_VERSION=0.1.0 docker compose -f docker-compose.prod.yml up -d
```

Images:
- `ghcr.io/thomasansems/heysummon` — main platform
- `ghcr.io/thomasansems/heysummon-guard` — guard proxy

---

## Making it public

Add a tunnel profile to expose HeySummon to the internet:

### Cloudflare Tunnel (recommended)

```bash
CLOUDFLARE_TUNNEL_TOKEN=your-token docker compose --profile cloudflare up -d
```

### Tailscale Funnel

```bash
TAILSCALE_AUTHKEY=your-key docker compose --profile tailscale up -d
```

### Ngrok

```bash
NGROK_AUTHTOKEN=your-token docker compose --profile ngrok up -d
```

---

## Debug tools

```bash
# Prisma Studio — browse the database at http://localhost:3447
docker compose --profile debug up -d
```

---

## Environment variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `NEXTAUTH_SECRET` | ✅ | — | Random 32-byte hex string |
| `NEXTAUTH_URL` | ✅ | — | Public URL of your instance |
| `MERCURE_JWT_SECRET` | ✅ | — | Random 32-byte hex string |
| `DB_PASSWORD` | ❌ | `heysummon_dev` | PostgreSQL password |
| `GUARD_PORT` | ❌ | `3445` | External port for Guard |
| `ALLOW_REGISTRATION` | ❌ | `false` | Allow multiple users to register |
| `HEYSUMMON_REQUEST_TTL_MS` | ❌ | `259200000` (72h) | Request expiry time |
| `AUTH_GITHUB_ID` | ❌ | — | GitHub OAuth app ID |
| `AUTH_GITHUB_SECRET` | ❌ | — | GitHub OAuth app secret |
| `HEYSUMMON_PUBLIC_URL` | ❌ | — | Public URL for callbacks |

---

## Updating

```bash
# Pull latest images and restart
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d
```

For local builds:

```bash
git pull
docker compose build
docker compose up -d
```

---

## Logs

```bash
docker compose logs -f app       # Platform logs
docker compose logs -f heysummon-guard   # Guard logs
docker compose logs -f mercure   # Mercure logs
```

---

## Backups

Back up the PostgreSQL volume:

```bash
docker exec heysummon-db-1 pg_dump -U heysummon heysummon > backup.sql
```

Restore:

```bash
cat backup.sql | docker exec -i heysummon-db-1 psql -U heysummon heysummon
```
