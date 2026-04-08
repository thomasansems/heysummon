<div align="center">

<img src="landingspage/public/sumo.jpg" alt="HeySummon" width="100%" />

# hey summon Pete

**AI does the work. Humans make the calls.**

The self-hosted, end-to-end encrypted human-in-the-loop platform for AI agents.
Your agent asks, a human expert responds, and the workflow continues.

[![CI](https://github.com/thomasansems/heysummon/actions/workflows/ci.yml/badge.svg)](https://github.com/thomasansems/heysummon/actions/workflows/ci.yml)
[![CodeQL](https://github.com/thomasansems/heysummon/actions/workflows/codeql.yml/badge.svg)](https://github.com/thomasansems/heysummon/actions/workflows/codeql.yml)
[![Docker](https://github.com/thomasansems/heysummon/actions/workflows/docker.yml/badge.svg)](https://github.com/thomasansems/heysummon/actions/workflows/docker.yml)
[![npm version](https://img.shields.io/npm/v/heysummon?color=orange&label=npm)](https://www.npmjs.com/package/heysummon)
[![License: SUL](https://img.shields.io/badge/license-Sustainable%20Use-blue)](LICENSE.md)

[Documentation](https://docs.heysummon.ai) | [Cloud Waitlist](https://cloud.heysummon.ai) | [Discord](https://discord.gg/8dfuKpqRHQ) | [Contributing](CONTRIBUTING.md)

</div>

---

## What is HeySummon?

HeySummon is an open-source platform that connects AI agents with human experts. When an agent gets stuck, needs approval, or lacks context, it sends an encrypted help request to a human expert who responds through the dashboard, Telegram, Slack, or another channel. The agent picks up the response and continues its workflow.

Think of it as **a pager for your AI agents** -- when they hit a wall, they summon a human.

### Why HeySummon?

- **AI agents aren't perfect.** They get stuck on ambiguous tasks, need approvals, or lack context. HeySummon gives them a structured way to ask for help without breaking their workflow.
- **End-to-end encrypted.** X25519 + AES-256-GCM encryption with Ed25519 signatures -- the platform never reads your messages.
- **Self-hosted.** Run it on your own infrastructure with full control. Your data never leaves your servers.

---

## Supported Platforms

### Client Side (AI Agents)

| Platform | Status |
|----------|--------|
| [Claude Code](https://docs.heysummon.ai/clients/claude-code) | Available |
| [Codex CLI](https://docs.heysummon.ai/clients/codex) (OpenAI) | Available |
| [Gemini CLI](https://docs.heysummon.ai/clients/gemini) (Google) | Available |
| [OpenClaw](https://docs.heysummon.ai/clients/openclaw) | Available |
| Cursor | Coming soon |
| Any HTTP client | Available via [Consumer SDK](https://docs.heysummon.ai/consumer/sdk) |

### Expert Side (Human Response Channels)

| Channel | Status |
|---------|--------|
| Dashboard (Web UI) | Available |
| Telegram | Available |
| Slack | Available |
| OpenClaw | Available |
| WhatsApp | Coming soon |

---

## When to Use HeySummon

HeySummon fits any workflow where an AI agent should pause and consult a human before proceeding.

> **Approval gates** -- "The agent wants to delete 2,000 rows from the production database. Should it proceed?"

> **Ambiguous instructions** -- "The spec says 'make it look better.' The agent asks: what does 'better' mean here -- faster load time, cleaner layout, or both?"

> **Domain expertise** -- "The agent is drafting a legal clause it's never seen before. It asks a lawyer to review the wording before finalizing the contract."

> **Compliance checks** -- "Before sending customer PII to an external API, the agent asks the data officer whether this data flow is approved."

> **Budget decisions** -- "The agent found three hosting options at different price points. It asks the team lead which one to pick."

### Giving Context to Your AI

When setting up a client, you provide **summoning context** -- a short set of guidelines (up to 500 characters) that tells the AI when to summon an expert. This keeps the agent from asking unnecessary questions while ensuring it escalates the right ones.

For example:

> "Only summon when you need to make an irreversible change, when the task involves production data, or when you're unsure about compliance requirements. Do not summon for routine code formatting or typo fixes."

---

## Quick Start

HeySummon offers multiple ways to get started:

| Method | Database | Best for |
|--------|----------|----------|
| `npx` | SQLite | Trying it out, quick install |
| `docker` | PostgreSQL | Building from source, containerized |
| `pnpm` | SQLite | Local development best for Contributing|



### Option 1: NPX Installer (Quickest)

```bash
npx @heysummon/app
```

Interactive setup -- downloads the latest release, generates secrets, configures auth, and starts the server. No Docker or Git required.

```bash
heysummon start -d    # Start in background
heysummon stop        # Stop the server
heysummon status      # Check if running
heysummon update      # Update to latest version
```

Installs to `~/.heysummon/` with SQLite -- zero external dependencies.

### Option 2: Docker (Recommended for Self-Hosting)

One command -- downloads compose file, generates secrets, starts everything:

```bash
curl -fsSL https://raw.githubusercontent.com/thomasansems/heysummon/main/install.sh | bash
```

Follow the instrucations from the `install.sh`, and you will be all set.

### Make it Public

The installer asks how you want to expose HeySummon. You can change your mind later by editing `.env` and re-running `docker compose --profile <name> up -d` from your install directory (`~/.heysummon-docker` by default).

| Option | Best for | What you need |
|--------|----------|---------------|
| **Direct port** | Quick LAN / VPN testing | Just an open port |
| **Caddy + HTTPS** *(recommended)* | Production on a VPS / EC2 | A domain you control |
| **Cloudflare Tunnel** | You already use Cloudflare DNS | A Cloudflare account |
| **Tailscale Funnel** | Free public URL, no domain | A Tailscale account |

#### Caddy + automatic HTTPS (recommended for production)

Caddy is a tiny reverse proxy that runs alongside HeySummon and **automatically obtains and renews a real Let's Encrypt certificate** for your domain. No certbot, no cron jobs, no renewal headaches.

**Requirements:**
1. A domain name you control (e.g. `heysummon.example.com`)
2. A DNS **A-record** pointing that domain to your server's public IP
3. Inbound TCP ports **80** and **443** open on your firewall / security group

**DNS record to add at your registrar:**

| Type | Name / Host | Value | TTL |
|------|-------------|-------|-----|
| `A` | `heysummon` *(or your subdomain)* | `<your server IP>` | `300` |

**Then on your server:**

```bash
cd ~/.heysummon-docker

# 1. Set your domain in .env
echo 'DOMAIN=heysummon.example.com' >> .env
sed -i 's|NEXTAUTH_URL=.*|NEXTAUTH_URL=https://heysummon.example.com|' .env
sed -i 's|HEYSUMMON_PUBLIC_URL=.*|HEYSUMMON_PUBLIC_URL=https://heysummon.example.com|' .env

# 2. Start with the caddy profile
docker compose --profile caddy up -d

# 3. Watch Caddy obtain the certificate (~10-30 seconds)
docker compose --profile caddy logs -f caddy
```

You should see `certificate obtained successfully` in the logs, then `https://heysummon.example.com` works with a real certificate, no warnings, no manual setup.

> **AWS EC2 tip:** Allocate an **Elastic IP** to your instance before setting up DNS. Without one, your public IP changes every time the instance restarts and your DNS record will be wrong.

#### Tunnels (no domain needed)

```bash
# Cloudflare Tunnel
docker compose --profile cloudflare up -d

# Tailscale Funnel
docker compose --profile tailscale up -d
```

Set the relevant token in your `.env` first (`CLOUDFLARE_TUNNEL_TOKEN` or `TAILSCALE_AUTHKEY`) and update `NEXTAUTH_URL` / `HEYSUMMON_PUBLIC_URL` to your public URL.

### User Registration

By default, only the **first user** can create an account -- they become the admin. After that, registration is closed.

| Scenario | Behavior |
|----------|----------|
| First visit (0 users) | Signup screen, first user becomes **admin** |
| After first user | Signup hidden, registration blocked (403) |
| `ALLOW_REGISTRATION=true` | Anyone can register (multi-user mode) |

### Debug Tools

```bash
# Prisma Studio -- browse/edit database at http://localhost:3447
# (requires docker-compose.dev.yml -- source build only)
docker compose -f docker-compose.dev.yml --profile debug up -d
```

### Option 3: Development Setup

For contributing or building from source:

```bash
git clone https://github.com/thomasansems/heysummon.git
cd heysummon
pnpm install
cp .env.example .env.local   # edit with your credentials
pnpm exec prisma generate && pnpm exec prisma db push
pnpm exec prisma db seed            # optional: sample data
pnpm dev
```

Or with Docker and local source builds:

```bash
git clone https://github.com/thomasansems/heysummon.git
cd heysummon
cp .env.example .env
docker compose -f docker-compose.dev.yml up -d
```

## Default Ports

| Environment | Guard (app) | Prisma Studio |
|-------------|-------------|---------------|
| **Docker** | `3445` | `3447` *(debug profile)* |
| **CLI** (`heysummon start`) | `3435` | `3437` *(optional)* |
| **Local dev** (`pnpm dev`) | `3425` | `3427` *(optional)* |

> Internal container-to-container traffic always uses port `3000` (app). These are never exposed directly.

---

## Architecture

```
                    +----------------------------------------------------------+
                    |              Docker (internal network)                    |
+----------+       |  +---------+      +----------+      +----------+         |  +----------+
| AI Agent |------>|  |  Guard  |----->| Platform |----->| Postgres |         |  |  Human   |
|(Consumer)| HTTPS |  |  :3000  |      |(internal)|      +----------+         |  | (Expert) |
+----------+       |  |Ed25519  |      | Next.js  |                           |  |Dashboard |
                   |  |signing  |      |          |--------- polling ---------|->|          |
                   |  +---------+      +----------+                           |  +----------+
                   |       ^                                                  |
                   |       |                                                  |
                   |  +---------+  (optional)                                 |
                   |  | Tunnel  |  Cloudflare / Tailscale                     |
                   |  +---------+                                             |
                   +----------------------------------------------------------+
```

**Key points:**
- **Guard** is the single entry point -- validates requests, adds Ed25519 signatures, and runs content safety checks (XSS, PII detection, URL defanging)
- **Platform** runs on an internal network with no exposed ports
- Experts and consumers discover events via HTTP polling
- E2E encryption means the platform stores ciphertext it cannot read
- Tunnel profiles (Cloudflare/Tailscale) route through Guard, never directly to Platform

---

## How It Works

**For Experts (Humans):**
1. Deploy HeySummon (Docker recommended)
2. Sign up at `http://localhost:3445` -- first user becomes admin
3. Create an expert profile and connect notification channels (Telegram, Slack)
4. Create an API key, choose a platform (Claude Code, Codex, Gemini, OpenClaw)
5. Click **Generate Setup Link** and send the URL to your AI client

**For Consumers (AI Agents):**
1. Paste the setup link from your expert into your session
2. Follow the guided setup to install the HeySummon skill and register the expert
3. Use the skill naturally -- `hey summon <expert> <question>`
4. The agent pauses and resumes when the expert responds

---

## Follow Guided Onboarding

When you first sign up, HeySummon walks you through a guided onboarding flow that sets up everything you need

- **Step 1:** Create Expert Profile: You pick a name and choose how you want to be notified when an AI agent needs help.
- **Step 2**: Configure Network Access: If your notification channel requires incoming webhooks (Telegram, Slack), HeySummon helps you set up a tunnel (Cloudflare or Tailscale)

- **Step 3**: Test Expert Channel: You respond through Telegram, Slack, or the dashboard to confirm the connection

- **Step 4**: Connect an AI Client: Choose your AI platform (Claude Code, Codex, Gemini, OpenClaw, Cursor) + Optional Settings

- **Step 5**: Summoning Guidelines: A wizard walks you through generating context for the AI: Autonomy, Safety, Human Strength and Fallback 

- **Final step!**: Copy-pastable text to give to your AI agent's and setup it this e2e connection safely. All set!


---

## API Overview

### Consumer API (for AI agents)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/v1/help` | Submit encrypted help request |
| `GET` | `/api/v1/help/:requestId` | Poll request status and get response |
| `POST` | `/api/v1/message/:requestId` | Send a message in the conversation |
| `GET` | `/api/v1/messages/:requestId` | Fetch message history |
| `POST` | `/api/v1/key-exchange/:requestId` | Exchange public keys for E2E encryption |
| `GET` | `/api/v1/events/pending` | Poll for pending events |
| `POST` | `/api/v1/events/ack/:requestId` | Acknowledge event delivery |
| `POST` | `/api/v1/close/:requestId` | Close a request |
| `POST` | `/api/v1/approve/:requestId` | Approve or deny a request |
| `GET` | `/api/v1/whoami` | Verify API key |
| `GET` | `/api/v1/requests/by-ref/:refCode` | Look up request by reference code |

All consumer endpoints authenticate via `x-api-key` header.

### Expert API (dashboard)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/requests` | List help requests |
| `GET` | `/api/requests/:id` | View decrypted request |
| `PATCH` | `/api/requests/:id` | Submit response |
| `GET` | `/api/keys` | List API keys |
| `POST` | `/api/keys` | Create API key |
| `POST` | `/api/keys/:id/rotate` | Rotate API key |
| `GET` | `/api/channels` | List notification channels |
| `POST` | `/api/channels` | Create notification channel |
| `GET` | `/api/audit-logs` | View audit history |

Expert endpoints use session authentication via the dashboard.

See the [full API reference](https://docs.heysummon.ai/reference/api) for request/response shapes, rate limits, and error codes.

---

## Self-Hosted vs Cloud

HeySummon is **self-hosted today**. You deploy it on your own infrastructure, and your data never leaves your servers. This is by design -- human-in-the-loop workflows often involve sensitive decisions, and self-hosting ensures you maintain full control.

A managed **cloud version** is being built. Join the waitlist at [cloud.heysummon.ai](https://cloud.heysummon.ai).

| | Self-Hosted | Cloud (coming soon) |
|---|---|---|
| **Deploy** | Your infrastructure | [cloud.heysummon.ai](https://cloud.heysummon.ai) |
| **Database** | SQLite or PostgreSQL | Managed |
| **Control** | Full | Managed |
| **Features** | Core platform | Core + teams, analytics |
| **Cost** | Free | Free tier planned |

Self-hosting works because expert contributors keep the platform secure. If you find a vulnerability, report it to `security@heysummon.ai` (do not open public GitHub issues for security bugs).

---

## Tech Stack

- **Next.js 16** -- App Router, React Server Components
- **Prisma 6** -- SQLite (default) or PostgreSQL
- **NextAuth.js v5** -- Email/password by default, GitHub + Google OAuth opt-in
- **shadcn/ui + Radix UI + Tailwind CSS** -- Dashboard UI
- **X25519 + AES-256-GCM** -- E2E encryption with Ed25519 signatures
- **Guard** -- Ed25519 signing reverse proxy with content safety (XSS, PII, URL defanging)

---

## Environment Variables

All `HEYSUMMON_*` variables are optional unless marked required.

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | `file:./dev.db` | Prisma connection string (SQLite or PostgreSQL) |
| `NEXTAUTH_SECRET` | -- | **Required.** Random secret for session signing |
| `NEXTAUTH_URL` | `http://localhost:3445` | Public base URL (used in OAuth callbacks) |
| `HEYSUMMON_PUBLIC_URL` | auto-detected | URL sent to consumers in setup links |
| `ALLOW_REGISTRATION` | `false` | Set `true` to allow multiple users to register |
| `HEYSUMMON_RETENTION_DAYS` | disabled | Auto-delete requests older than N days |
| `DEBUG` | `false` | Set `true` for verbose API logging |
| `GITHUB_ID` / `GITHUB_SECRET` | -- | GitHub OAuth credentials (optional) |
| `GOOGLE_ID` / `GOOGLE_SECRET` | -- | Google OAuth credentials (optional) |
| `CLOUDFLARE_TUNNEL_TOKEN` | -- | Token for Cloudflare tunnel profile |
| `TAILSCALE_AUTHKEY` | -- | Auth key for Tailscale tunnel profile |

**Consumer-side variables** (in `~/.heysummon/.env`):

| Variable | Default | Description |
|----------|---------|-------------|
| `HEYSUMMON_BASE_URL` | -- | **Required.** URL of your HeySummon instance |
| `HEYSUMMON_EXPERTS_FILE` | `~/.heysummon/experts.json` | Path to registered experts file |
| `HEYSUMMON_POLL_INTERVAL` | `5` | Polling interval in seconds |

---

<!-- Video: Add product demo link here when available -->

## Community and Contributing

HeySummon is open source and welcomes contributions -- especially around security, new platform integrations, and expert notification channels.

- **Contribute**: See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines
- **Discord**: Join the community at [discord.gg/8dfuKpqRHQ](https://discord.gg/8dfuKpqRHQ)
- **Issues**: [github.com/thomasansems/heysummon/issues](https://github.com/thomasansems/heysummon/issues)
- **Security**: Report vulnerabilities to `security@thomasansems.nl`

---

## License

HeySummon uses a dual license model:

- **Core** -- [Sustainable Use License](LICENSE.md). Free for personal and internal business use.
- **Cloud features** -- Files containing `.cloud.` in their filename or `.cloud` in their dirname are under the [HeySummon Cloud License](LICENSE_CLOUD.md) and require a valid subscription for production use.

All other code is available under the Sustainable Use License. See [LICENSE.md](LICENSE.md) for full terms.

---

<div align="center">

**[Documentation](https://docs.heysummon.ai)** | **[Cloud Waitlist](https://cloud.heysummon.ai)** | **[Discord](https://discord.gg/8dfuKpqRHQ)** | **[GitHub](https://github.com/thomasansems/heysummon)**

</div>
