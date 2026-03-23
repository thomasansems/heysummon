# HeySummon Architecture

## Overview

HeySummon connects AI agents to human experts via a platform API. When an agent needs help, it submits a request to the platform, which notifies the registered provider (human). The provider responds, and the agent receives the answer.

## Flow

```
AI Agent (Claude Code / OpenClaw)
    |
    +- scripts/ask.sh "question" "context" "ProviderName"
    |       |
    |       +- SDK CLI → POST /api/v1/help
    |       |                |
    |       |            Platform notifies provider (Telegram/WhatsApp)
    |       |                |
    |       +- polls GET /api/v1/help/:id (every 3s, up to 15 min)
    |       |                |
    |       |            Human responds
    |       |                |
    |       +- returns response on stdout
    |
    +- Background watcher (PM2)
            |
            +- polls pending/*.json for timed-out requests
            +- writes to inbox/*.json when responses arrive
```

## Components

### Consumer SDK (`packages/consumer-sdk/`)

TypeScript SDK providing:
- **HeySummonClient** — HTTP client for the platform API
- **ProviderStore** — JSON file manager for registered providers
- **RequestTracker** — File-based request tracking
- **Crypto** — Ed25519 + X25519 + AES-256-GCM encryption
- **PollingWatcher** — Event polling with deduplication
- **CLI** — 7 subcommands used by bash wrappers

### Skill Scripts (`skills/heysummon/scripts/`)

Thin bash wrappers calling the SDK CLI:
- `ask.sh` — Main entry (blocking, --async, --check)
- `submit.sh` — Non-blocking submit
- `check-inbox.sh` — Read inbox responses
- `setup.sh` — Interactive setup
- `watcher.js` — PM2 persistent poller (Node.js, zero deps)
- `setup-watcher.sh` — PM2 lifecycle management

### Platform API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/v1/help` | POST | Submit a help request |
| `/api/v1/help/:id` | GET | Get request status |
| `/api/v1/events/pending` | GET | Poll for events |
| `/api/v1/events/ack/:id` | POST | Acknowledge event |
| `/api/v1/messages/:id` | GET | Get messages for request |
| `/api/v1/whoami` | GET | Identify provider from API key |
| `/api/v1/requests/by-ref/:ref` | GET | Look up request by ref code |

## SDK CLI Resolution

Scripts resolve the SDK CLI in this order:
1. `HEYSUMMON_SDK_DIR` env var (explicit override)
2. Git root monorepo path (`packages/consumer-sdk/src/cli.ts`)
3. npm package (`npx @heysummon/consumer-sdk`)
