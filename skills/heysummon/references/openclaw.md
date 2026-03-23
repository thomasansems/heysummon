# OpenClaw Integration

HeySummon integrates with OpenClaw agents via a persistent background watcher and hooks system.

## Setup

```bash
# 1. Register provider
bash scripts/add-provider.sh "hs_cli_key" "FriendlyName"

# 2. Start watcher + configure hooks
bash scripts/openclaw-setup.sh
```

The `openclaw-setup.sh` script:
- Generates keypairs in `.keys/`
- Generates a hooks token for `/hooks/agent` calls
- Registers the token in `~/.openclaw/openclaw.json`
- Starts the platform watcher via PM2 (`heysummon-watcher`)

## Scripts

| Script | Purpose |
|--------|---------|
| `submit-request.sh` | Submit help request (auto-starts watcher) |
| `platform-watcher.sh` | Event poller → calls notify.sh per event |
| `notify.sh` | Delivers notifications via OpenClaw hooks/agent or Telegram |
| `openclaw-setup.sh` | Full setup: keypairs, hooks token, PM2 watcher |
| `teardown.sh` | Stop the PM2 watcher |

## Event Flow

```
Provider responds (Telegram)
    ↓
Platform watcher polls /api/v1/events/pending
    ↓
SDK CLI watch → calls notify.sh with event JSON
    ↓
notify.sh → POST /hooks/agent (wakes agent in existing session)
    ↓
Agent resumes with full conversation context
```

## Notification Modes

- **message** — POST to `/hooks/agent` (wakes agent in existing session)
- **file** — Append to JSONL + POST `/cron/wake`

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `HEYSUMMON_BASE_URL` | `http://localhost:3445` | Platform API |
| `HEYSUMMON_NOTIFY_MODE` | `message` | Notification mode |
| `HEYSUMMON_NOTIFY_TARGET` | *(required)* | Chat ID |
| `HEYSUMMON_KEY_DIR` | `.keys` | Keypair directory |
| `HEYSUMMON_REQUESTS_DIR` | `.requests` | Request tracking |
| `HEYSUMMON_PROVIDERS_FILE` | `$HOME/.heysummon/providers.json` | Provider registry |
| `HEYSUMMON_HOOKS_TOKEN` | *(auto-generated)* | Hooks auth token |
| `HEYSUMMON_SESSION_KEY` | *(auto-detected)* | Agent session key |
| `HEYSUMMON_AGENT_ID` | `tertiary` | Agent ID to wake |

## PM2 Process Names

- **OpenClaw**: `heysummon-watcher`
- **Claude Code**: `heysummon-cc-watcher`

These are distinct names so both can run on the same VPS without conflict.
