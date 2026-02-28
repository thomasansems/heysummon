# Docker

The recommended way to self-host HeySummon. Includes the Guard proxy, Next.js platform, PostgreSQL, and Mercure.

---

## Prerequisites

- Docker 24+
- Docker Compose v2

---

## Quick start

One command — no source code, no manual secret generation:

```bash
curl -fsSL https://raw.githubusercontent.com/thomasansems/heysummon/main/install.sh | bash
```

This script:
1. Creates `~/.heysummon-docker/`
2. Downloads `docker-compose.yml`
3. Generates `NEXTAUTH_SECRET`, `MERCURE_JWT_SECRET`, and `DB_PASSWORD` automatically
4. Writes a ready-to-use `.env`
5. Runs `docker compose up -d`

Open `http://localhost:3445` when done.

To pin a specific release, set `HEYSUMMON_VERSION=0.1.0` in your `.env` before running the script, or after the fact with:

```bash
cd ~/.heysummon-docker
HEYSUMMON_VERSION=0.1.0 docker compose up -d
```

Images:
- `ghcr.io/thomasansems/heysummon` — main platform
- `ghcr.io/thomasansems/heysummon-guard` — guard proxy

> **Contributing or want to build from source?** Use `docker-compose.dev.yml` instead:
> ```bash
> git clone https://github.com/thomasansems/heysummon.git && cd heysummon
> cp .env.example .env
> docker compose -f docker-compose.dev.yml up -d
> ```

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
# (requires source checkout + docker-compose.dev.yml)
docker compose -f docker-compose.dev.yml --profile debug up -d
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
docker compose pull
docker compose up -d
```

For source builds:

```bash
git pull
docker compose -f docker-compose.dev.yml build
docker compose -f docker-compose.dev.yml up -d
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
