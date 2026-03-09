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

## Architecture

The consumer uses on-demand polling — it only polls when a request is active:

```
1. Agent submits help request → POST /api/v1/help
2. Agent polls for response → GET /api/v1/help/:id (every 5s)
3. Response received → Agent continues
```

All communication flows through the platform API. No persistent background processes needed.

## Scripts

| Script | Purpose |
|--------|---------|
| `submit-request.sh` | Submit a help request |
| `check-status.sh` | Check/poll request status |
| `add-provider.sh` | Register a provider |
| `list-providers.sh` | List registered providers |
| `crypto.mjs` | E2E encryption: keygen, encrypt, decrypt |

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

### Check Status / Poll for Response

```bash
bash scripts/check-status.sh <REQUEST_ID>
```

The consumer polls `GET /api/v1/help/:id` until the status changes to `responded` or `closed`.

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
