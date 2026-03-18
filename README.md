<div align="center">

# 🦞 HeySummon

**Human in the Loop as a Service**

Connect AI agents with human experts — in real time, E2E encrypted, self-hostable.

[![CI](https://github.com/thomasansems/heysummon/actions/workflows/ci.yml/badge.svg)](https://github.com/thomasansems/heysummon/actions/workflows/ci.yml)
[![CodeQL](https://github.com/thomasansems/heysummon/actions/workflows/codeql.yml/badge.svg)](https://github.com/thomasansems/heysummon/actions/workflows/codeql.yml)
[![Docker](https://github.com/thomasansems/heysummon/actions/workflows/docker.yml/badge.svg)](https://github.com/thomasansems/heysummon/actions/workflows/docker.yml)
[![npm version](https://img.shields.io/npm/v/heysummon?color=orange&label=npm)](https://www.npmjs.com/package/heysummon)
[![License: SUL](https://img.shields.io/badge/license-Sustainable%20Use-blue)](LICENSE.md)

[Documentation](https://docs.heysummon.ai) · [Cloud](https://cloud.heysummon.ai) · [Contributing](CONTRIBUTING.md)

</div>

---

## What is HeySummon?

HeySummon is an open-source platform that lets AI agents ask humans for help when they get stuck. An agent sends an encrypted help request, a human expert answers through the dashboard, and the agent picks up the response via HTTP polling.

Think of it as **a pager for your AI agents**: when they hit a wall, they summon a human.

### Why HeySummon?

- **AI agents aren't perfect.** They get stuck on ambiguous tasks, need approvals, or lack context. HeySummon gives them a structured way to ask for help without breaking their workflow.
- **E2E encrypted.** The platform never reads your messages — RSA-OAEP + AES-256-GCM hybrid encryption.
- **Self-hostable.** Run it on your own infrastructure with full control, or use the managed cloud.

## Features

| | Feature | Description |
|---|---|---|
| 📡 | **HTTP Polling** | Event discovery via polling API with acknowledgment |
| 🔐 | **E2E Encryption** | RSA-OAEP + AES-256-GCM — zero-knowledge relay |
| 👥 | **Multi-Provider** | Multiple human experts can handle requests |
| 🔑 | **API Keys** | Issue and manage consumer API keys from the dashboard |
| 📊 | **Dashboard** | Review, decrypt, and respond to requests in a clean UI |
| 📎 | **Reference Codes** | `HS-XXXX` codes for easy tracking |
| ⏱️ | **Auto-Expiry** | Requests expire after 24 hours |
| 🐳 | **Docker Ready** | One command to deploy with Postgres |

## Quick Start

HeySummon offers three ways to get started, depending on your use case:

| Method | Database | Best for | Time |
|--------|----------|----------|------|
| `npx heysummon` | SQLite | Quick install, trying it out | ~2 min |
| `curl … \| bash` (install.sh) | PostgreSQL | Self-hosting, production | ~2 min |
| `docker compose -f docker-compose.dev.yml up` | PostgreSQL | Contributing, building from source | ~5 min |
| `npm run dev` | SQLite | Local development | ~5 min |

### Option 1: NPX Installer (Quickest)

```bash
npx heysummon
```

Interactive setup — downloads the latest release, generates secrets, configures auth, and starts the server. No Docker or Git required.

```bash
heysummon start -d    # Start in background
heysummon stop        # Stop the server
heysummon status      # Check if running
heysummon update      # Update to latest version
```

Installs to `~/.heysummon/` with SQLite — zero external dependencies.

### Option 2: Docker (Recommended for Self-Hosting)

One command — downloads compose file, generates secrets, starts everything:

```bash
curl -fsSL https://raw.githubusercontent.com/thomasansems/heysummon/main/install.sh | bash
```

Installs to `~/.heysummon-docker/`. The app is available at `http://localhost:3445`.

Includes: **Guard** (reverse proxy with Ed25519 request signing) → **Next.js app** → **PostgreSQL**.

```bash
# To stop / update
cd ~/.heysummon-docker
docker compose down
docker compose pull && docker compose up -d
```

### Make it Public

Add a tunnel to expose your instance to the internet. From your install directory (`~/.heysummon-docker` by default):

```bash
# Cloudflare Tunnel (recommended for production)
docker compose --profile cloudflare up -d

# Tailscale Funnel (great for teams)
docker compose --profile tailscale up -d

# Ngrok (quick testing)
docker compose --profile ngrok up -d
```

Set the relevant token in your `.env` first (`CLOUDFLARE_TUNNEL_TOKEN`, `TAILSCALE_AUTHKEY`, or `NGROK_AUTHTOKEN`) and update `NEXTAUTH_URL` / `HEYSUMMON_PUBLIC_URL` to your public URL.

### User Registration

By default, only the **first user** can create an account — they become the admin. After that, registration is closed.

| Scenario | Behavior |
|----------|----------|
| First visit (0 users) | Signup screen, first user becomes **admin** |
| After first user | Signup hidden, registration blocked (403) |
| `ALLOW_REGISTRATION=true` | Anyone can register (multi-user mode) |

To enable open registration, add to your `.env`:

```bash
ALLOW_REGISTRATION=true
```

### Debug Tools

```bash
# Prisma Studio — browse/edit database at http://localhost:3447
# (requires docker-compose.dev.yml — source build only)
docker compose -f docker-compose.dev.yml --profile debug up -d
```

### Option 3: Development Setup

For contributing or building from source:

```bash
git clone https://github.com/thomasansems/heysummon.git
cd heysummon
npm install
cp .env.example .env.local   # edit with your credentials
npx prisma generate && npx prisma db push
npx prisma db seed            # optional: sample data
npm run dev
```

Or if you prefer Docker with local source builds:

```bash
git clone https://github.com/thomasansems/heysummon.git
cd heysummon
cp .env.example .env
docker compose -f docker-compose.dev.yml up -d
```

## Default Ports

| Environment | Guard (app) | Prisma Studio | Ngrok dashboard |
|-------------|-------------|---------------|-----------------|
| **Docker** | `3445` | `3447` *(debug profile)* | `3448` *(ngrok profile)* |
| **CLI** (`heysummon start`) | `3435` | `3437` *(optional)* | — |
| **Local dev** (`npm run dev`) | `3425` | `3427` *(optional)* | — |

> Internal container-to-container traffic always uses port `3000` (app). These are never exposed directly.

---

## Architecture

```
                    ┌─────────────────────────────────────────────────────────┐
                    │              Docker (internal network)                  │
┌──────────┐       │  ┌─────────┐      ┌──────────┐      ┌──────────┐      │  ┌──────────┐
│ AI Agent │──────▶│  │  Guard  │─────▶│ Platform │─────▶│ Postgres │      │  │  Human   │
│(Consumer)│ HTTPS │  │  :3000  │      │(internal)│      └──────────┘      │  │(Provider)│
└──────────┘       │  │Ed25519  │      │ Next.js  │                        │  │Dashboard │
                   │  │signing  │      │          │────────── polling ─────│─▶│          │
                   │  └─────────┘      └──────────┘                        │  └──────────┘
                   │       ▲                                               │
                   │       │                                               │
                   │  ┌─────────┐  (optional)                              │
                   │  │ Tunnel  │  Cloudflare / Tailscale / Ngrok          │
                   │  └─────────┘                                          │
                   └─────────────────────────────────────────────────────────┘
```

**Key points:**
- **Guard** is the single entry point — validates requests, adds Ed25519 signatures
- **Platform** runs on an internal network with no exposed ports
- Providers and consumers discover events via HTTP polling
- E2E encryption means the platform stores ciphertext it cannot read
- Tunnel profiles (Cloudflare/Tailscale/Ngrok) route through Guard, never directly to Platform

## API Overview

### Consumer API (for AI agents)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/api/v1/help` | API key | Submit encrypted help request |
| `GET` | `/api/v1/help/:id` | API key | Poll status / get encrypted response |
| `POST` | `/api/v1/key-exchange` | API key | Exchange public keys for E2E |
| `GET` | `/api/v1/events/pending` | API key | Poll for pending events |

### Provider API (dashboard)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/api/requests` | Session | List help requests |
| `GET` | `/api/requests/:id` | Session | View decrypted request |
| `PATCH` | `/api/requests/:id` | Session | Submit response |
| `GET` | `/api/keys` | Session | Manage API keys |
| `POST` | `/api/keys` | Session | Create API key |

## Self-Hosted vs Cloud

| | Self-Hosted | Cloud |
|---|---|---|
| **Deploy** | Your infrastructure | [cloud.heysummon.ai](https://cloud.heysummon.ai) |
| **Database** | SQLite or Postgres | Managed |
| **Control** | Full | Managed |
| **Features** | Core platform | Core + teams, analytics |
| **Cost** | Free | Free tier available |

## Tech Stack

- **Next.js 15** — App Router, React Server Components
- **Prisma** — SQLite (default) or Postgres
- **NextAuth.js v5** — Email/password by default, GitHub + Google OAuth opt-in
- **HTTP Polling** — Event discovery via polling API
- **Tailwind CSS** + shadcn/ui — Dashboard UI
- **RSA-OAEP + AES-256-GCM** — Hybrid E2E encryption

## Quick Start by Role

### As a Provider (Human Expert)

1. Deploy HeySummon (Docker recommended, see above)
2. Sign up at `http://localhost:3445` — first user becomes admin
3. Go to **Providers** → create a provider profile
4. Go to **Clients** → create an API key, choose a channel (OpenClaw or Claude Code)
5. Click **Generate Setup Link** → send the URL to your client
6. Go to **Channels** → connect Telegram if you want push notifications

### As a Consumer (AI Agent — OpenClaw)

1. Paste the setup link from your provider in your chat
2. Follow the guided steps: install skill → register provider → start watcher → configure hook
3. Use the `heysummon` skill in OpenClaw: `Ask provider: how do I ...?`
4. Your agent will pause and resume when the expert responds

### As a Consumer (AI Agent — Claude Code)

1. Paste the setup link from your provider in your chat
2. Follow the guided steps: add MCP server → verify connection
3. Use the `heysummon` tool inside Claude Code naturally
4. Claude will wait up to 5 minutes for your expert's response

---

## Environment Variables

All `HEYSUMMON_*` variables are optional unless marked required.

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | `file:./dev.db` | Prisma connection string (SQLite or PostgreSQL) |
| `NEXTAUTH_SECRET` | — | **Required.** Random secret for session signing |
| `NEXTAUTH_URL` | `http://localhost:3445` | Public base URL (used in OAuth callbacks) |
| `HEYSUMMON_PUBLIC_URL` | auto-detected | URL sent to consumers in setup links |
| `ALLOW_REGISTRATION` | `false` | Set `true` to allow multiple users to register |
| `HEYSUMMON_RETENTION_DAYS` | disabled | Auto-delete requests older than N days |
| `DEBUG` | `false` | Set `true` for verbose API logging |
| `AUTH_GITHUB_ID` / `AUTH_GITHUB_SECRET` | — | GitHub OAuth credentials (optional) |
| `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` | — | Google OAuth credentials (optional) |
| `GUARD_SIGNING_KEY` | — | Ed25519 private key for Guard (auto-generated in Docker) |
| `GUARD_PUBLIC_KEY` | — | Ed25519 public key for Platform (auto-generated in Docker) |
| `REQUIRE_GUARD` | `false` | Set `true` to reject requests not signed by Guard |
| `CLOUDFLARE_TUNNEL_TOKEN` | — | Token for Cloudflare tunnel profile |
| `TAILSCALE_AUTHKEY` | — | Auth key for Tailscale tunnel profile |
| `NGROK_AUTHTOKEN` | — | Token for Ngrok tunnel profile |

**Consumer-side variables** (in `~/.heysummon/.env`):

| Variable | Default | Description |
|----------|---------|-------------|
| `HEYSUMMON_BASE_URL` | — | **Required.** URL of your HeySummon instance |
| `HEYSUMMON_PROVIDERS_FILE` | `~/.heysummon/providers.json` | Path to registered providers file |
| `HEYSUMMON_POLL_INTERVAL` | `5` | Polling interval in seconds |
| `HEYSUMMON_NOTIFY_MODE` | `message` | Notification mode: `message` or `file` |
| `HEYSUMMON_NOTIFY_TARGET` | — | Telegram chat ID for provider response notifications |
| `HEYSUMMON_HOOKS_TOKEN` | — | Security token for openclaw.json hook integration |
| `HEYSUMMON_SESSION_KEY` | — | OpenClaw session key to wake on response |

---

## API Reference

See [`docs/api.md`](docs/api.md) for the full API reference with request/response shapes, authentication, rate limits, and error codes.

---

## Contributing

We welcome contributions! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## License

HeySummon uses a dual license model (similar to n8n):

- **Core** — [Sustainable Use License](LICENSE.md). Free for personal and internal business use.
- **Cloud features** — Files containing `.cloud.` in their filename or `.cloud` in their dirname are under the [HeySummon Cloud License](LICENSE_CLOUD.md) and require a valid subscription for production use.

All other code is available under the Sustainable Use License. See [LICENSE.md](LICENSE.md) for full terms.

---

<div align="center">

**[Documentation](https://docs.heysummon.ai)** · **[Cloud](https://cloud.heysummon.ai)** · **[GitHub](https://github.com/thomasansems/heysummon)**

Made with 🦞 by the HeySummon team

</div>
