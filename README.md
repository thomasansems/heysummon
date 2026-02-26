<div align="center">

# 🦞 HeySummon

**Human in the Loop as a Service**

Connect AI agents with human experts — in real time, E2E encrypted, self-hostable.

[![CI](https://github.com/thomasansems/heysummon/actions/workflows/ci.yml/badge.svg)](https://github.com/thomasansems/heysummon/actions/workflows/ci.yml)
[![CodeQL](https://github.com/thomasansems/heysummon/actions/workflows/codeql.yml/badge.svg)](https://github.com/thomasansems/heysummon/actions/workflows/codeql.yml)
[![Docker](https://github.com/thomasansems/heysummon/actions/workflows/docker.yml/badge.svg)](https://github.com/thomasansems/heysummon/actions/workflows/docker.yml)
[![License: SUL](https://img.shields.io/badge/license-Sustainable%20Use-blue)](LICENSE.md)
[![Version](https://img.shields.io/badge/version-0.1.0--alpha.1-orange)](package.json)

[Documentation](https://docs.heysummon.ai) · [Cloud](https://cloud.heysummon.ai) · [Contributing](CONTRIBUTING.md)

</div>

---

## What is HeySummon?

HeySummon is an open-source platform that lets AI agents ask humans for help when they get stuck. An agent sends an encrypted help request, a human expert answers through the dashboard, and the agent picks up the response — all in real time via SSE.

Think of it as **a pager for your AI agents**: when they hit a wall, they summon a human.

### Why HeySummon?

- **AI agents aren't perfect.** They get stuck on ambiguous tasks, need approvals, or lack context. HeySummon gives them a structured way to ask for help without breaking their workflow.
- **E2E encrypted.** The platform never reads your messages — RSA-OAEP + AES-256-GCM hybrid encryption.
- **Self-hostable.** Run it on your own infrastructure with full control, or use the managed cloud.

## Features

| | Feature | Description |
|---|---|---|
| 📡 | **Real-time SSE** | Instant push updates via Server-Sent Events (Mercure-powered internally) |
| 🔐 | **E2E Encryption** | RSA-OAEP + AES-256-GCM — zero-knowledge relay |
| 👥 | **Multi-Provider** | Multiple human experts can handle requests |
| 🔑 | **API Keys** | Issue and manage consumer API keys from the dashboard |
| 📊 | **Dashboard** | Review, decrypt, and respond to requests in a clean UI |
| 📎 | **Reference Codes** | `HS-XXXX` codes for easy tracking |
| ⏱️ | **Auto-Expiry** | Requests expire after 24 hours |
| 🐳 | **Docker Ready** | One command to deploy with Postgres + Mercure |

## Quick Start

HeySummon offers three ways to get started, depending on your use case:

| Method | Database | Best for | Time |
|--------|----------|----------|------|
| `npx heysummon` | SQLite | Quick install, trying it out | ~2 min |
| `docker compose up` | PostgreSQL | Production, self-hosting | ~3 min |
| `npm run dev` | SQLite | Contributing, development | ~5 min |

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

### Option 2: Docker (Recommended for Production)

```bash
git clone https://github.com/thomasansems/heysummon.git
cd heysummon
cp .env.example .env        # edit secrets
docker compose up -d
```

The app is available at `http://localhost:3000` via Guard. Ed25519 keys are auto-generated.

Includes: **Guard** (reverse proxy with Ed25519 request signing) → **Next.js app** → **PostgreSQL** + **Mercure** (real-time SSE).

### Make it Public

Add a tunnel to expose your instance to the internet:

```bash
# Cloudflare Tunnel (recommended for production)
docker compose --profile cloudflare up -d

# Tailscale Funnel (great for teams)
docker compose --profile tailscale up -d

# Ngrok (quick testing)
docker compose --profile ngrok up -d
```

See **[Self-Hosting Guide](docs/SELF-HOSTING.md)** for setup instructions per provider.

### Option 3: Development Setup

```bash
git clone https://github.com/thomasansems/heysummon.git
cd heysummon
npm install
cp .env.example .env.local   # edit with your credentials
npx prisma generate && npx prisma db push
npx prisma db seed            # optional: sample data
npm run dev
```

## Architecture

```
                    ┌─────────────────────────────────────────────────────────┐
                    │              Docker (internal network)                  │
┌──────────┐       │  ┌─────────┐      ┌──────────┐      ┌──────────┐      │  ┌──────────┐
│ AI Agent │──────▶│  │  Guard  │─────▶│ Platform │─────▶│ Postgres │      │  │  Human   │
│(Consumer)│ HTTPS │  │  :3000  │      │(internal)│      └──────────┘      │  │(Provider)│
└──────────┘       │  │Ed25519  │      │ Next.js  │      ┌──────────┐      │  │Dashboard │
                   │  │signing  │      │          │─────▶│ Mercure  │──SSE─│─▶│          │
                   │  └─────────┘      └──────────┘      │(internal)│      │  └──────────┘
                   │       ▲                              └──────────┘      │
                   │       │                                               │
                   │  ┌─────────┐  (optional)                              │
                   │  │ Tunnel  │  Cloudflare / Tailscale / Ngrok          │
                   │  └─────────┘                                          │
                   └─────────────────────────────────────────────────────────┘
```

**Key points:**
- **Guard** is the single entry point — validates requests, adds Ed25519 signatures
- **Platform** runs on an internal network with no exposed ports
- Mercure is internal only — clients connect via the Next.js SSE proxy
- E2E encryption means the platform stores ciphertext it cannot read
- Tunnel profiles (Cloudflare/Tailscale/Ngrok) route through Guard, never directly to Platform

## API Overview

### Consumer API (for AI agents)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/api/v1/help` | API key | Submit encrypted help request |
| `GET` | `/api/v1/help/:id` | API key | Poll status / get encrypted response |
| `POST` | `/api/v1/key-exchange` | API key | Exchange public keys for E2E |
| `GET` | `/api/v1/events` | API key | SSE stream for real-time updates |

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
- **Mercure** — Internal real-time hub, proxied as SSE to clients
- **Tailwind CSS** + shadcn/ui — Dashboard UI
- **RSA-OAEP + AES-256-GCM** — Hybrid E2E encryption

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
