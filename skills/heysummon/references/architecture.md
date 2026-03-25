# HeySummon Architecture

## Overview

HeySummon connects AI agents to human experts via a platform API. When an agent needs help, it submits a request to the platform, which notifies the registered provider (human). The provider responds, and the agent receives the answer.

## Flow

```
AI Agent (any supported platform)
    |
    +- scripts/ask.sh "question" "context" "ProviderName"
            |
            +- SDK CLI submit-and-poll -> POST /api/v1/help
            |       |
            |   Provider available?
            |       |
            |   YES: Platform creates request, notifies provider (Telegram/phone)
            |   NO:  Platform rejects request, returns nextAvailableAt
            |       (tracked as MissedRequest for dashboard visibility)
            |
            +- polls GET /api/v1/help/:id (every 3s, up to 15 min)
            |       |
            |   Human responds
            |       |
            +- returns response on stdout
            |
            (no background processes -- done)
```

## Components

### Consumer SDK (`packages/consumer-sdk/`)

TypeScript SDK providing:
- **HeySummonClient** -- HTTP client for the platform API
- **ProviderStore** -- JSON file manager for registered providers
- **Crypto** -- Ed25519 + X25519 + AES-256-GCM encryption
- **CLI** -- 5 subcommands used by bash wrappers: `submit-and-poll`, `add-provider`, `list-providers`, `check-status`, `keygen`

### Skill Scripts (`skills/heysummon/scripts/`)

Thin bash wrappers calling the SDK CLI:
- `ask.sh` -- Blocking poll (submit + wait for response or timeout)
- `setup.sh` -- Interactive setup (URL, API key, provider registration)
- `add-provider.sh` -- Register a provider
- `list-providers.sh` -- List registered providers
- `check-status.sh` -- Check request status
- `sdk.sh` -- SDK CLI resolver

### Platform API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/v1/help` | POST | Submit a help request (rejects if provider unavailable) |
| `/api/v1/help/:id` | GET | Get request status |
| `/api/v1/events/pending` | GET | Poll for events |
| `/api/v1/events/ack/:id` | POST | Acknowledge event |
| `/api/v1/messages/:id` | GET | Get messages for request |
| `/api/v1/whoami` | GET | Identify provider from API key |
| `/api/v1/requests/by-ref/:ref` | GET | Look up request by ref code |

## Provider Availability

Providers configure availability windows (quiet hours, available days, timezone) in the dashboard. When a request arrives outside the availability window:

1. The platform **rejects** the request (no HelpRequest created)
2. A `MissedRequest` record tracks the rejection with client info and next available time
3. The consumer receives `rejected: true` with `nextAvailableAt` and a human-readable message
4. Missed requests are visible in the dashboard stats and requests page

## SDK CLI Resolution

Scripts resolve the SDK CLI in this order:
1. `HEYSUMMON_SDK_DIR` env var (explicit override)
2. Git root monorepo path (`packages/consumer-sdk/src/cli.ts`)
3. npm package (`npx @heysummon/consumer-sdk`)
