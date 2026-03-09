# HeySummon Consumer Skill

When you (an AI agent) get stuck, request help from a human expert via HeySummon.

When someone requests help, the skill submits a request to the HeySummon platform. The platform matches it to a registered provider (human expert) who can assist. Users can say "Hey summon John Doe to help" or "Hey summon a Python expert to help". The skill then routes the request to the appropriate provider based on the registered providers in `providers.json`.

## Architecture (MCP-first)

This skill uses a **polling watcher** to receive notifications — no SSE/Mercure required.

```
HeySummon Platform API (/api/v1/requests?status=PENDING)
           ↓
    Polling Watcher (pm2, every 5s)
           ↓
   OpenClaw Notification
           ↓
        Your Chat
```

For AI tools (Claude Code, Cursor, etc.), use the **MCP server** instead:

```bash
claude mcp add heysummon npx @heysummon/mcp
```

## Setup

### Step 1: Configure Environment

Create `.env` in the skill directory:

```env
HEYSUMMON_BASE_URL=http://localhost:3425
HEYSUMMON_API_KEY=hs_cli_your_key_here
HEYSUMMON_NOTIFY_MODE=message
HEYSUMMON_NOTIFY_TARGET=your_chat_id
HEYSUMMON_POLL_INTERVAL=5
```

**Get API Key:**
1. Go to your HeySummon dashboard
2. Navigate to Users → Create user profile (or ask provider for client key)
3. Create a **client key** (starts with `hs_cli_...`)

### Step 2: Register Provider(s)

```bash
bash scripts/add-provider.sh "hs_cli_your_key" "FriendlyName"
```

### Step 3: Start Polling Watcher

```bash
bash scripts/setup.sh
```

Starts a polling watcher (pm2) that polls `/api/v1/requests?status=PENDING` every 5 seconds and sends notifications via OpenClaw.

To stop:
```bash
bash scripts/teardown.sh
```

## Scripts

| Script | Purpose |
|--------|---------|
| `setup.sh` | Start the polling watcher (pm2) |
| `teardown.sh` | Stop the watcher |
| `platform-watcher.sh` | Polling watcher → sends notifications via OpenClaw |
| `submit-request.sh` | Submit a help request |
| `add-provider.sh` | Register a provider |
| `list-providers.sh` | List registered providers |
| `check-status.sh` | Check request status |

## Usage

### Submit a Help Request

```bash
bash scripts/submit-request.sh "Your question" '[{"role":"user","content":"context"}]' "ProviderName"
```

### For AI Tools (Claude Code / Cursor / Windsurf)

Use the MCP server — no watcher needed:

```bash
# Install globally
claude mcp add heysummon npx @heysummon/mcp

# Or point to local packages/mcp-server
claude mcp add heysummon node /path/to/heysummon/packages/mcp-server/index.js
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `HEYSUMMON_BASE_URL` | `http://localhost:3425` | Platform API URL |
| `HEYSUMMON_API_KEY` | *(required)* | Client API key (`hs_cli_...`) |
| `HEYSUMMON_NOTIFY_MODE` | `message` | Notification mode: `message` or `file` |
| `HEYSUMMON_NOTIFY_TARGET` | *(required for message mode)* | Chat ID for notifications |
| `HEYSUMMON_POLL_INTERVAL` | `5` | Poll interval in seconds |
| `HEYSUMMON_REQUESTS_DIR` | `{skill}/.requests` | Directory for request tracking |

## Security

- ✅ **API keys** stored in `.env` (gitignored)
- ✅ **All paths** relative to skill directory
- ✅ **E2E encryption** handled by platform
- ✅ **No hardcoded credentials** in code
