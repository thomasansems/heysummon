# HeySummon Consumer Skill

When you (an AI agent) get stuck, request help from a human expert via HeySummon.

When someone requests help, the skill submits a request to the HeySummon platform. The platform matches it to a registered provider (human expert) who can assist. Users can say "Hey summon John Doe to help" or "Hey summon a Python expert to help". The skill then routes the request to the appropriate provider based on the registered providers in `providers.json`.

## Setup

### Step 1: Configure Environment

Create or update `.env` in the skill directory with your HeySummon platform details:

```env
HEYSUMMON_BASE_URL=http://thomas-pc.tail38a1e7.ts.net:3425
HEYSUMMON_NOTIFY_MODE=message
HEYSUMMON_NOTIFY_TARGET=your_chat_id
```

**Platform Options:**
- **Self-hosted:** Use your local/server URL (e.g., `http://localhost:3425`)
- **Cloud:** Use the provided cloud URL from setup link

**Get API Key from Setup Link:**
When you receive a HeySummon setup link, extract the API key from the JWT token:
1. The URL contains a JWT: `setup/eyJhbGc...`
2. Decode the JWT payload to find: `"key": "hs_cli_XXXXX"`
3. Use that `hs_cli_XXXXX` value in `.env`

**⚠️ If You Already Have a Setup:**
If you've already configured HeySummon with one API key and receive a NEW setup link:
- **Option A:** Update `.env` with the new key (replaces old consumer)
- **Option B:** Keep multiple providers in `providers.json` and update `.env` to use the new key when you want to submit new requests

Each setup link creates a new **consumer context**. Multiple providers can respond to the same consumer.

⚠️ **Security:** API keys starting with `hs_prov_` are provider keys (not client keys). Use only `hs_cli_...` keys in `.env`.

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
| `platform-watcher.sh` | Thin wrapper → SDK CLI watch + notify.sh |
| `notify.sh` | OpenClaw-specific notification delivery (hooks/agent, Telegram) |
| `submit-request.sh` | Submit a help request (via SDK CLI) |
| `add-provider.sh` | Register a provider (via SDK CLI) |
| `list-providers.sh` | List registered providers (via SDK CLI) |
| `check-status.sh` | Check request status (via SDK CLI) |
| `auto-sync.sh` | Git auto-sync (cron job) |

> **Note:** E2E crypto, request tracking, provider resolution, and polling are now handled by the shared consumer SDK at `packages/consumer-sdk/`. The `crypto.mjs` script has been replaced by the SDK crypto module.

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
  "path": "/hooks",
  "mappings": [{ "wakeMode": "now" }],
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
