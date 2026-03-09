# 🦞 HeySummon Consumer Skill

> Get help from human experts when your AI agent gets stuck.

HeySummon is a Human-in-the-Loop (HITL) service that connects AI agents with human experts. This skill provides a secure communication channel between OpenClaw agents and HeySummon providers.

---

## ✨ Features

- 🔐 **End-to-end encryption** (E2E) via X25519 + Ed25519
- 📡 **On-demand polling** — only polls when a request is active
- 🏷️ **Multi-provider support** with friendly name routing
- 🛡️ **Secure by default** — no credentials in code or commits

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────┐
│                  OpenClaw Agent (You)                    │
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │ HeySummon Consumer Skill                        │   │
│  │                                                 │   │
│  │  1. Submit Request ──> POST /api/v1/help        │   │
│  │  2. Poll for response → GET /api/v1/help/:id    │   │
│  │  3. Response received → Continue work           │   │
│  └─────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
                           │
                           │ HTTPS
                           ▼
┌─────────────────────────────────────────────────────────┐
│              HeySummon Platform (Server)                 │
│                                                         │
│  • POST /api/v1/help        (submit request)            │
│  • GET  /api/v1/help/:id    (poll for response)         │
│  • POST /api/v1/message/:id (send a message)            │
│  • GET  /api/v1/messages/:id (list messages)            │
│                                                         │
│  🔒 E2E Encryption Server-Side                         │
└─────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│              HeySummon Provider (Expert)                 │
│                                                         │
│  • Receives requests via provider dashboard / polling   │
│  • Responds with expert advice                          │
│  • Uses same E2E encryption                             │
└─────────────────────────────────────────────────────────┘
```

**Key Points:**
- All communication goes through the **HeySummon Platform API** (no direct P2P)
- **E2E encryption** is handled **server-side** by the platform
- **Consumer polls on-demand** — no persistent background process needed

---

## 📦 Installation

### Prerequisites

- **Node.js** (for crypto.mjs)
- **curl** (for API calls)
- **jq** (for JSON parsing)
- **OpenClaw** (for notifications)

### Setup

1. **Create `.env` file:**
   ```bash
   cp .env.example .env
   # Edit .env with your API key and platform URL
   ```

2. **Register your first provider:**
   ```bash
   bash scripts/add-provider.sh "hs_cli_your_key_here" "ProviderName"
   ```

---

## ⚙️ Configuration

### Environment Variables (`.env`)

```env
# HeySummon Platform URL
HEYSUMMON_BASE_URL=http://localhost:3445

# Your client API key (get this from platform dashboard)
HEYSUMMON_API_KEY=hs_cli_your_key_here

# Notification settings (for OpenClaw routing)
HEYSUMMON_NOTIFY_MODE=message
HEYSUMMON_NOTIFY_TARGET=telegram_target_chat_id_here
```

### Platform URL Options

- **Self-hosted:** `http://localhost:3445` (default)
- **Cloud:** `https://cloud.heysummon.ai`
- **Custom server:** `https://heysummon.yourdomain.com`

### API Key Format

- ✅ **Client key:** `hs_cli_...` or `htl_cli_...`
- ❌ **Provider key:** `hs_prov_...` (will be rejected)

---

## 🚀 Usage

### 1. Submit a Help Request

```bash
bash scripts/submit-request.sh \
  "How do I configure Nginx reverse proxy?" \
  '[{"role":"user","content":"I am stuck on SSL setup"}]' \
  "DevOpsExpert"
```

**Output:**
```
📡 Provider: DevOpsExpert
✅ Request submitted
📨 Request ID: cmm123abc...
🔖 Ref Code: HS-A1B2
⏳ Status: pending
```

### 2. Check Request Status

```bash
bash scripts/check-status.sh cmm123abc...
```

The script polls `GET /api/v1/help/:id` until it receives a response.

---

## 📚 Scripts Reference

| Script | Purpose | Usage |
|--------|---------|-------|
| `submit-request.sh` | Submit help request | See [Usage](#usage) |
| `check-status.sh` | Check/poll request status | `bash scripts/check-status.sh <request-id>` |
| `add-provider.sh` | Register provider | `bash scripts/add-provider.sh <key> <name>` |
| `list-providers.sh` | List providers | `bash scripts/list-providers.sh` |
| `crypto.mjs` | E2E encryption | Auto-called by submit |

---

## 🔒 Security

### What's Protected

✅ **Gitignored (never committed):**
- `.env` (API keys)
- `providers.json` (contains API keys)
- `.keys/` (encryption keypairs)
- `.requests/` (active request tracking)
- `*.jsonl` (event logs)

✅ **Path Security:**
- All paths are **relative** to skill directory
- No hardcoded user paths
- Configurable via environment variables

---

## 🐛 Troubleshooting

### Invalid API Key Error

**Problem:** `{"error":"Invalid or inactive API key"}`

**Solutions:**
1. Verify key format starts with `hs_cli_` (not `hs_prov_`)
2. Check key is active in platform dashboard
3. Ensure `.env` has correct `HEYSUMMON_BASE_URL`
4. Test with: `curl -s ${BASE_URL}/api/v1/whoami -H "x-api-key: ${KEY}"`

### Provider Not Found

**Problem:** `Provider 'XYZ' not found in providers.json`

**Solutions:**
1. List providers: `bash scripts/list-providers.sh`
2. Add provider: `bash scripts/add-provider.sh <key> <name>`

---

## 🔧 Directory Structure

```
heysummon/
├── .env                    # Config (gitignored)
├── .gitignore              # Excludes secrets
├── SKILL.md                # Skill documentation (for OpenClaw)
├── README.md               # This file
├── providers.json          # Provider registry (gitignored)
├── .keys/                  # Encryption keypairs (gitignored)
├── .requests/              # Active request tracking (gitignored)
└── scripts/
    ├── submit-request.sh   # Submit help request
    ├── check-status.sh     # Check request status
    ├── add-provider.sh     # Register provider
    ├── list-providers.sh   # List providers
    └── crypto.mjs          # E2E encryption
```
