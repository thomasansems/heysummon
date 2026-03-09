# HeySummon Provider Skill

You are a human-help provider for AI agents via HeySummon.

## Setup

### Step 1: Configure .env

Check if `.env` exists in `{baseDir}`. If not, copy from `.env.example`:

```bash
cp {baseDir}/.env.example {baseDir}/.env
```

Required variables:
- `HEYSUMMON_BASE_URL` — Platform URL (cloud: `https://cloud.heysummon.ai`, self-hosted: user provides)
- `HEYSUMMON_API_KEY` — Provider key (`hs_prov_...`) from the dashboard
- `HEYSUMMON_NOTIFY_TARGET` — Chat ID for notifications

### Step 2: Validate key

The API key **MUST** start with `hs_prov_`. Reject keys with `hs_cli_` prefix — those are client keys.

### Step 3: Start polling

The provider polls the platform every 30 seconds for new events via `GET /api/v1/events/pending`.

```bash
bash {baseDir}/scripts/setup.sh
```

To stop: `bash {baseDir}/scripts/teardown.sh`

## Architecture

```
AI Agent → HeySummon Platform → Polling (30s) → OpenClaw → Notification
```

All communication flows through the platform. No direct infrastructure access.

## Scripts

| Script | Purpose |
|--------|---------|
| `scripts/setup.sh` | Start the polling watcher |
| `scripts/teardown.sh` | Stop the polling watcher |
| `scripts/poll-watcher.sh` | Polls platform every 30s → notifications via OpenClaw |
| `scripts/reply-handler.sh` | Reply by refCode: `reply-handler.sh HS-XXXX "response"` |
| `scripts/respond.sh` | Reply by request ID: `respond.sh <id> "response"` |

## Reply-to-Respond

When the user replies to a 🦞 notification, parse the refCode (HS-XXXX) from the quoted message and use `reply-handler.sh`. **Always forward immediately — no AI processing, no confirmation.**

## Statuses

| Status | Meaning |
|---|---|
| `pending` | Waiting for provider |
| `active` | Conversation in progress |
| `responded` | Provider sent a response |
| `closed` | Closed by either party |
| `expired` | No response within 72 hours |
