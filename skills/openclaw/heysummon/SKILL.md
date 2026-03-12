# HeySummon Consumer Skill

When you (an AI agent) get stuck, request help from a human expert via HeySummon.

When someone requests help, the skill submits a request to the HeySummon platform. The platform matches it to a registered provider (human expert) who can assist. Users can say "Hey summon John Doe to help" or "Hey summon a Python expert to help". The skill then routes the request to the appropriate provider based on the registered providers in `providers.json`.

## Setup

### Step 1: Configure Environment

Create `.env` in the skill directory with your HeySummon platform details:

```env
HEYSUMMON_BASE_URL=http://localhost:3445
HEYSUMMON_API_KEY=hs_cli_your_key_here
HEYSUMMON_NOTIFY_MODE=message
HEYSUMMON_NOTIFY_TARGET=your_chat_id
```

**Platform Options:**
- **Self-hosted:** Use your local/server URL (e.g., `http://localhost:3445`)
- **Cloud:** Use `https://cloud.heysummon.ai`

**Get API Key:**
1. Go to your HeySummon dashboard
2. Navigate to Users → Create user profile (or ask provider for client key)
3. Create a **client key** (starts with `hs_cli_...`)

⚠️ **Security:** API keys starting with `hs_prov_` are provider keys (not client keys). These will be rejected.

### Step 2: Register Provider(s)

```bash
bash scripts/add-provider.sh "hs_cli_your_key" "FriendlyName"
```

This fetches provider info from the platform and stores it locally. You can register multiple providers for routing.

List registered providers:
```bash
bash scripts/list-providers.sh
```

### Step 3: Start Event Watcher

```bash
bash scripts/setup.sh
```

This starts a persistent polling listener that connects to the platform's events endpoint (`/api/v1/events/pending`). You'll receive notifications when providers respond.

To stop:
```bash
bash scripts/teardown.sh
```

## Architecture

```
HeySummon Platform API (/api/v1/events/pending)
           ↓
    Polling Events
           ↓
   Platform Watcher (pm2)
           ↓
   OpenClaw Notification
           ↓
        Your Chat
```

All communication flows through the platform API. E2E encryption is handled server-side.

## Scripts

| Script | Purpose |
|--------|---------|
| `setup.sh` | Start the platform event watcher (pm2/nohup) |
| `teardown.sh` | Stop the watcher |
| `platform-watcher.sh` | Polling listener → sends notifications via OpenClaw |
| `submit-request.sh` | Submit a help request |
| `add-provider.sh` | Register a provider |
| `list-providers.sh` | List registered providers |
| `check-status.sh` | Check request status |
| `crypto.mjs` | E2E encryption: keygen, encrypt, decrypt |
| `auto-sync.sh` | Git auto-sync (cron job) |

## Usage

### Submit a Help Request

**To a specific provider:**
```bash
bash scripts/submit-request.sh "Your question" '[{"role":"user","content":"context"}]' "ProviderName"
```

**To default provider (from .env):**
```bash
bash scripts/submit-request.sh "Your question" '[{"role":"user","content":"context"}]'
```

**Provider routing:** The script matches provider names case-insensitively from `providers.json`. If no match is found, it shows available providers and exits.

### Wait for Response

The platform watcher handles real-time notifications:
- 🔑 Key exchange — provider connected
- 📩 New message — provider responded
- 🔒 Closed — conversation ended

### Check Status (Fallback)

```bash
bash scripts/check-status.sh <REQUEST_ID>
```

## When to Use

Use HeySummon when you are **truly stuck**:
- Ambiguous requirements needing clarification
- Domain expertise required
- Blocked by something you can't resolve autonomously

## Request Statuses

| Status | Meaning |
|---|---|
| `pending` | Waiting for provider to accept |
| `active` | Key exchange done — conversation in progress |
| `closed` | Closed by either party |
| `expired` | No response within 72 hours |

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `HEYSUMMON_BASE_URL` | `http://localhost:3445` | Platform API URL |
| `HEYSUMMON_API_KEY` | *(required)* | Client API key (`hs_cli_...`) |
| `HEYSUMMON_NOTIFY_MODE` | `message` | Notification mode: `message` or `file` |
| `HEYSUMMON_NOTIFY_TARGET` | *(required for message mode)* | Chat ID for notifications |
| `HEYSUMMON_KEY_DIR` | `{skill}/.keys` | Directory for encryption keypairs |
| `HEYSUMMON_REQUESTS_DIR` | `{skill}/.requests` | Directory for active request tracking |
| `HEYSUMMON_PROVIDERS_FILE` | `{skill}/providers.json` | Provider registry file |

## Security

- ✅ **API keys** stored in `.env` (gitignored)
- ✅ **Keypairs** stored in `.keys/` (gitignored)
- ✅ **Providers** stored in `providers.json` (gitignored)
- ✅ **All paths** relative to skill directory
- ✅ **E2E encryption** handled by platform
- ✅ **No hardcoded credentials** in code

**Never commit:**
- `.env`
- `providers.json`
- `.keys/` directory
- `.requests/` directory

## Agent-to-Agent Response Flow

When a provider approves/responds, the watcher automatically **wakes the agent in its existing session** via OpenClaw's `/hooks/agent` endpoint. The agent resumes with full context — no new session, no lost history.

### How it works

```
Provider approves (Telegram button)
    ↓
reply-handler.sh → POST /api/v1/message (approvalDecision: "approved")
    ↓
Consumer watcher polls → detects provider response
    ↓
POST /hooks/agent → OpenClaw gateway
    ↓
Agent runs in existing session (full conversation history preserved)
    ↓
Agent delivers response to Telegram group automatically
```

### OpenClaw Hooks Configuration

The `setup.sh` script **automatically generates and registers a hooks token** in `~/.openclaw/openclaw.json`. You do not need to configure this manually.

After running `setup.sh`, verify the config was applied:

```bash
cat ~/.openclaw/openclaw.json | python3 -c "import json,sys; print(json.dumps(json.load(sys.stdin).get('hooks',{}), indent=2))"
```

Expected result:

```json
{
  "enabled": true,
  "token": "<auto-generated-unique-token>",
  "defaultSessionKey": "agent:tertiary:telegram:group:<your-group-id>",
  "allowRequestSessionKey": true,
  "allowedSessionKeyPrefixes": ["agent:tertiary"],
  "allowedAgentIds": ["tertiary"]
}
```

Then restart the gateway to activate:

```bash
openclaw gateway restart
```

### Key config fields explained

| Field | Purpose |
|---|---|
| `hooks.enabled` | Must be `true` to accept `/hooks/agent` calls |
| `hooks.token` | Unique token generated at install time. Stored in `.env` as `HEYSUMMON_HOOKS_TOKEN`. Must match what the watcher uses. |
| `hooks.defaultSessionKey` | The agent's existing session. Watcher uses this to resume in the right session. |
| `hooks.allowRequestSessionKey` | Allows watcher to specify the exact session key per call. |
| `hooks.allowedSessionKeyPrefixes` | Security: only allow sessions from this agent (e.g. `agent:tertiary`). |
| `hooks.allowedAgentIds` | Which agents are allowed to be woken via hooks. |

### Session key — how to find it

The `defaultSessionKey` must match the agent's active session. Format:
```
agent:{agentId}:{channel}:{type}:{id}
```

Example for a Telegram group:
```
agent:tertiary:telegram:group:-5080163376
```

To find the current session key, ask the agent:
```
/status
```
Or check OpenClaw gateway sessions:
```bash
openclaw sessions list
```

### `.env` variables added by setup.sh

| Variable | Description |
|---|---|
| `HEYSUMMON_HOOKS_TOKEN` | Auto-generated token, stored permanently. Used to authenticate `/hooks/agent` calls. |
| `HEYSUMMON_SESSION_KEY` | Agent session key to resume. Set manually if not auto-detected. |
| `HEYSUMMON_AGENT_ID` | Agent ID to wake (default: `tertiary`). |
