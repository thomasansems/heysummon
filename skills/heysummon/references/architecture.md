# HeySummon Architecture

## Overview

HeySummon connects AI agents to human experts via a platform API. When an agent needs help, it submits a request to the platform, which notifies the registered expert (human). The expert responds, and the agent receives the answer.

## Flow

```
AI Agent (any supported platform)
    |
    +- scripts/ask.sh "question" "context" "ExpertName"
            |
            +- SDK CLI submit-and-poll -> POST /api/v1/help
            |       |
            |   Expert available?
            |       |
            |   YES: Platform creates request, notifies expert (Telegram/phone)
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
- **ExpertStore** -- JSON file manager for registered experts
- **Crypto** -- Ed25519 + X25519 + AES-256-GCM encryption
- **CLI** -- 5 subcommands used by bash wrappers: `submit-and-poll`, `add-expert`, `list-experts`, `check-status`, `keygen`

### Skill Scripts (`skills/heysummon/scripts/`)

Thin bash wrappers calling the SDK CLI:
- `ask.sh` -- Blocking poll (submit + wait for response or timeout)
- `setup.sh` -- Interactive setup (URL, API key, expert registration)
- `add-expert.sh` -- Register an expert
- `list-experts.sh` -- List registered experts
- `check-status.sh` -- Check request status
- `sdk.sh` -- SDK CLI resolver

### Platform API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/v1/help` | POST | Submit a help request (rejects if expert unavailable) |
| `/api/v1/help/:id` | GET | Get request status |
| `/api/v1/events/pending` | GET | Poll for events |
| `/api/v1/events/ack/:id` | POST | Acknowledge event |
| `/api/v1/messages/:id` | GET | Get messages for request |
| `/api/v1/whoami` | GET | Identify expert from API key |
| `/api/v1/requests/by-ref/:ref` | GET | Look up request by ref code |

## Expert Availability

Experts configure availability windows (quiet hours, available days, timezone) in the dashboard. When a request arrives outside the availability window:

1. The platform **rejects** the request (no HelpRequest created)
2. A `MissedRequest` record tracks the rejection with client info and next available time
3. The consumer receives `rejected: true` with `nextAvailableAt` and a human-readable message
4. Missed requests are visible in the dashboard stats and requests page

## SDK CLI Resolution

Scripts resolve the SDK CLI in this order:
1. `HEYSUMMON_SDK_DIR` env var (explicit override)
2. Git root monorepo path (`packages/consumer-sdk/src/cli.ts`)
3. npm package (`pnpm dlx @heysummon/consumer-sdk`)
