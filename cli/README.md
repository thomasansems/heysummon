<div align="center">

# 🦞 HeySummon CLI

**The fastest way to self-host HeySummon — no Docker, no Git, one command.**

[![npm version](https://img.shields.io/npm/v/heysummon)](https://www.npmjs.com/package/heysummon)
[![License: SUL](https://img.shields.io/badge/license-Sustainable%20Use-blue)](https://github.com/thomasansems/heysummon/blob/main/LICENSE.md)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18-brightgreen)](https://nodejs.org)

[Documentation](https://docs.heysummon.ai) · [Cloud](https://cloud.heysummon.ai) · [GitHub](https://github.com/thomasansems/heysummon)

</div>

---

## What is HeySummon?

HeySummon is an open-source **Human-in-the-Loop platform for AI agents**. When an AI agent gets stuck, needs approval, or requires human context, it sends an encrypted help request to a human expert — in real time, end-to-end encrypted, via a clean dashboard.

Think of it as **a pager for your AI agents**: they summon a human when they hit a wall, get a response, and continue their workflow — all without breaking the loop.

- **E2E encrypted** — RSA-OAEP + AES-256-GCM. The server never reads your messages.
- **Real-time** — SSE-powered push updates, no polling needed.
- **Self-hostable** — full control, runs on a single machine with SQLite.
- **Or use the cloud** — [cloud.heysummon.ai](https://cloud.heysummon.ai) if you'd rather not host anything.

---

## Why a CLI?

The HeySummon platform is a full Next.js application. The CLI exists so you can install and manage it without touching Git, Docker, or config files manually. It handles:

- Downloading the latest release from GitHub
- Generating cryptographic secrets
- Configuring your environment interactively
- Setting up the SQLite database and running migrations
- Building the app
- Starting, stopping, and updating the server

One command gets you from zero to a running server.

---

## Quick Start

```bash
npx heysummon
```

The interactive installer walks you through everything. Takes ~2 minutes. No Docker or Git required.

Once installed, open the URL shown in the terminal to create your account.

---

## Commands

```
heysummon [command]
```

| Command | Description |
|---|---|
| `heysummon` / `heysummon init` | First-time setup — download, configure, build, and start |
| `heysummon start` | Start the server |
| `heysummon start -d` | Start the server in the background (daemon) |
| `heysummon stop` | Stop the server |
| `heysummon status` | Check if the server is running |
| `heysummon update` | Update to the latest release |
| `heysummon uninstall` | Safely remove all data and stop the server |

### Options

```
--help, -h      Show help
--version, -v   Show version
```

---

## What gets installed

Everything lives in `~/.heysummon/`:

```
~/.heysummon/
├── app/                 ← Next.js server (downloaded from GitHub)
│   ├── prisma/
│   │   └── heysummon.db ← SQLite database (your data)
│   └── .next/           ← build output
├── .env                 ← config & secrets
└── heysummon.pid        ← running server PID
```

The CLI binary itself is installed separately via npm and is not part of `~/.heysummon/`.

---

## Updating

```bash
heysummon update
```

Downloads the latest release, runs migrations, rebuilds, and restarts — your data is preserved.

---

## Uninstalling

```bash
heysummon uninstall
```

Stops the server, offers a database backup, asks for explicit confirmation, and removes `~/.heysummon/`. Then remove the CLI binary:

```bash
npm uninstall -g heysummon
```

> **Note:** `npm uninstall` alone only removes the CLI binary — it does **not** touch `~/.heysummon/`. Always run `heysummon uninstall` first for a clean removal.

---

## Requirements

| | Minimum |
|---|---|
| Node.js | 18+ |
| OS | Linux, macOS, WSL2 |
| Disk | ~500 MB (app + build) |

---

## Alternative installation methods

The CLI is the easiest path but not the only one. Choose based on your use case:

### Docker (recommended for production)

Full stack with PostgreSQL, Mercure, Guard reverse proxy, and optional tunnel:

```bash
git clone https://github.com/thomasansems/heysummon.git
cd heysummon
cp .env.example .env   # edit secrets
docker compose up -d
```

#### Make it publicly accessible

```bash
# Cloudflare Tunnel (recommended for production)
docker compose --profile cloudflare up -d

# Tailscale Funnel (great for teams, zero config firewall)
docker compose --profile tailscale up -d

# Ngrok (quick testing)
docker compose --profile ngrok up -d
```

See the [Self-Hosting Guide](https://docs.heysummon.ai/self-hosting) for per-provider setup.

### Managed Cloud

No self-hosting at all — [cloud.heysummon.ai](https://cloud.heysummon.ai) is the hosted version with a free tier.

### Comparison

| Method | Database | Tunnel | Best for |
|---|---|---|---|
| `npx heysummon` (this CLI) | SQLite | Manual / reverse proxy | Quick start, single machine |
| Docker Compose | PostgreSQL | Cloudflare / Tailscale / Ngrok | Production, teams |
| Cloud | Managed | Built-in | Zero ops |

---

## Using HeySummon from an AI agent

Once your server is running, install the SDK in your agent's project:

```bash
npm install @heysummon/sdk
```

```ts
import { HeySummon } from "@heysummon/sdk";

const hs = new HeySummon({ apiKey: "hs_cli_..." });

const response = await hs.ask("Should I proceed with deleting the old records?");
console.log(response); // human's answer, E2E decrypted
```

Get your API key from the dashboard under **Settings → API Keys**.

---

## Documentation

- **[Getting started](https://docs.heysummon.ai/getting-started/quickstart)**
- **[SDK reference](https://docs.heysummon.ai/sdk)**
- **[Self-hosting guide](https://docs.heysummon.ai/self-hosting)**
- **[API reference](https://docs.heysummon.ai/api)**
- **[GitHub repository](https://github.com/thomasansems/heysummon)**

---

## License

HeySummon uses a sustainable use model:

- **Core platform** — [Sustainable Use License](https://github.com/thomasansems/heysummon/blob/main/LICENSE.md). Free for personal and internal business use.
- **Cloud features** — separate [HeySummon Cloud License](https://github.com/thomasansems/heysummon/blob/main/LICENSE_CLOUD.md).

---

<div align="center">

**[docs.heysummon.ai](https://docs.heysummon.ai)** · **[cloud.heysummon.ai](https://cloud.heysummon.ai)** · **[GitHub](https://github.com/thomasansems/heysummon)**

Made with 🦞 by the HeySummon team

</div>
