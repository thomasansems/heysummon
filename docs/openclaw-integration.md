# OpenClaw Integration Guide

> How HeySummon connects OpenClaw agents (like Sandy) with human providers for async approvals and Q&A.

---

## What is this?

HeySummon bridges AI agents and human experts. An OpenClaw agent (the **consumer**) can pause its workflow, send a question or approval request to a human (the **provider**), and automatically resume when the human responds — all without losing context.

**Key properties:**
- ✅ Fully async — the agent doesn't block while waiting
- ✅ Context-preserving — the agent resumes in the same session it was in
- ✅ Polling-based — no webhooks, no SSE, no Mercure required
- ✅ Works behind NAT/WSL — no public URL needed

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        OpenClaw (local)                         │
│                                                                 │
│  ┌──────────────┐    sessions_send / hooks/agent                │
│  │ Sandy        │◄────────────────────────────────┐            │
│  │ (tertiary    │                                  │            │
│  │  agent)      │──── submit-request.sh ──►        │            │
│  └──────────────┘                         │        │            │
│                                           │        │            │
│  ┌──────────────────────────┐             │        │            │
│  │ Consumer Watcher         │             │        │            │
│  │ (platform-watcher.sh)    │◄────────────┘        │            │
│  │ polls every 5s           │  stores request ID   │            │
│  │                          │──── polls events ──► │            │
│  └──────────────────────────┘                      │            │
│             │  on response: POST /hooks/agent ──────┘            │
└─────────────┼───────────────────────────────────────────────────┘
              │
              ▼ HTTP (localhost:3425)
┌─────────────────────────────────────────────────────────────────┐
│                    HeySummon Server (local)                      │
│                    Next.js, SQLite, port 3425                   │
│                                                                 │
│  POST /api/v1/requests          ← consumer submits              │
│  GET  /api/v1/events/pending    ← consumer polls                │
│  POST /api/v1/events/ack        ← consumer acks event           │
│  GET  /api/v1/requests/by-ref   ← look up by refCode            │
│  POST /api/v1/message/[id]      ← provider sends response       │
│  GET  /api/v1/messages/[id]     ← consumer reads messages       │
└─────────────────────────────────────────────────────────────────┘
              │
              ▼ HTTP (localhost:3425)
┌─────────────────────────────────────────────────────────────────┐
│                      Provider Side (local)                      │
│                                                                 │
│  ┌──────────────────────────┐   ┌───────────────────────────┐  │
│  │ Provider Watcher         │   │ Thomas (human)            │  │
│  │ (provider-watcher.sh)    │   │                           │  │
│  │ polls every 10s          │──►│ Telegram notification:    │  │
│  │                          │   │ 🦞 HS-XXXX New request    │  │
│  └──────────────────────────┘   │ [✅ Approve] [❌ Deny]    │  │
│              │                  └───────────┬───────────────┘  │
│              │                              │                   │
│  reply-handler.sh ◄──────────────────────── │ hs:approve:HS-XX │
│  (detects approved/denied,                  │ (Telegram reply)  │
│   calls POST /api/v1/message/[id])          │                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## End-to-End Flow

### Step 1 — Sandy submits a request (~1s)

Sandy calls `submit-request.sh` with a question or approval request:

```bash
bash submit-request.sh \
  --type approval \
  --question "Should I delete all test data?" \
  --provider "thomas"
```

The script:
1. Generates a session keypair (Ed25519 + X25519)
2. Posts to `POST /api/v1/requests`
3. Receives a `requestId` + `refCode` (e.g. `HS-TEAZ9K2P`)
4. Saves the mapping: `~/.requests/{requestId}` → `HS-TEAZ9K2P`
5. Returns the refCode to Sandy

**Duration: ~300–800ms**

---

### Step 2 — Provider is notified (~5–15s delay)

The **provider watcher** polls `GET /api/v1/events/pending` every 10 seconds.

When a new request event arrives:
1. Watcher decrypts the question (server decrypts with `serverPrivateKey`)
2. Sends a Telegram notification to Thomas:
   ```
   🦞 HeySummon [HS-TEAZ9K2P] New request
   🗳️ Approval needed
   📝 Should I delete all test data?
   ```
3. Buttons: ✅ Ja / ❌ Nee (inline Telegram keyboard)

**Notification delay: 0–10s (polling interval)**

---

### Step 3 — Thomas responds (~seconds to minutes)

Thomas taps ✅ or ❌ in Telegram. This sends a reply message:
```
hs:approve:HS-TEAZ9K2P
```

The `reply-handler.sh` script:
1. Parses the refCode (`HS-TEAZ9K2P`) from the reply
2. Looks up the `requestId` via `GET /api/v1/requests/by-ref/HS-TEAZ9K2P`
3. Calls `POST /api/v1/message/{requestId}` with:
   ```json
   {
     "plaintext": "approved",
     "from": "provider",
     "approvalDecision": "approved"
   }
   ```
4. HeySummon stores the response + emits a `new_message` event

**Duration: ~500ms–1s**

---

### Step 4 — Sandy is woken up (~5s delay)

The **consumer watcher** polls `GET /api/v1/events/pending` every 5 seconds.

When a `new_message` event with `from: "provider"` arrives:
1. Watcher fetches the response text from `GET /api/v1/messages/{requestId}`
2. Fetches the original question via `GET /api/v1/requests/by-ref/{refCode}`
3. Builds a rich wake message:
   ```
   HeySummon antwoord ontvangen voor HS-TEAZ9K2P.

   Jouw oorspronkelijke vraag was:
   Should I delete all test data?

   Antwoord van de provider: approved

   Ga nu verder op basis van dit antwoord.
   ```
4. Calls `POST /hooks/agent` on the OpenClaw gateway:
   ```json
   {
     "message": "<wake message>",
     "agentId": "tertiary",
     "sessionKey": "agent:tertiary:telegram:group:-5080163376",
     "deliver": true,
     "channel": "telegram",
     "to": "-5080163376",
     "wakeMode": "now"
   }
   ```
5. OpenClaw runs Sandy's agent turn **in her existing session** (full conversation history preserved)

**Notification delay: 0–5s (polling interval)**

---

### Step 5 — Sandy resumes (~2–10s)

Sandy receives the full context and continues her workflow:
- She knows the original question (because it's in the wake message)
- She knows the answer (`approved` / `denied` / free text)
- She's in her existing session — all prior conversation is still there
- She delivers her response to the Telegram group

**Agent response time: 2–10s (depends on model)**

---

## Total End-to-End Timing

| Phase | Min | Typical | Max |
|---|---|---|---|
| Submit request | 0.3s | 0.5s | 1s |
| Provider notified | 0s | 5s | 10s |
| Thomas responds | 5s | 30s | ∞ (human) |
| Consumer watcher detects | 0s | 2.5s | 5s |
| Sandy responds | 2s | 5s | 10s |
| **Total (excl. human)** | **~3s** | **~13s** | **~26s** |

---

## Configuration

### OpenClaw (`~/.openclaw/openclaw.json`)

```json
{
  "hooks": {
    "enabled": true,
    "token": "your-hooks-token",
    "path": "/hooks",
    "allowedAgentIds": ["tertiary", "main", "secondary"],
    "defaultSessionKey": "agent:tertiary:telegram:group:-5080163376",
    "allowRequestSessionKey": true,
    "allowedSessionKeyPrefixes": ["agent:tertiary"]
  }
}
```

**Key fields:**
- `defaultSessionKey` — Sandy's existing session (full history preserved)
- `allowRequestSessionKey: true` — allows watcher to specify the exact session
- `allowedSessionKeyPrefixes` — security: only allow Sandy's sessions

### Consumer skill (`.env`)

```env
HEYSUMMON_BASE_URL=https://cloud-ab85427a4321ed520e58a4.heysummon.ai
HEYSUMMON_API_KEY=hs_cli_xxxx
HEYSUMMON_NOTIFY_MODE=message
HEYSUMMON_NOTIFY_TARGET=-5080163376
HEYSUMMON_SESSION_KEY=agent:tertiary:telegram:group:-5080163376
HEYSUMMON_AGENT_ID=tertiary
OPENCLAW_PORT=18789
POLL_INTERVAL=5
```

### Provider skill (`.env`)

```env
HEYSUMMON_BASE_URL=http://localhost:3425
HEYSUMMON_API_KEY=hs_prov_xxxx
HEYSUMMON_NOTIFY_TARGET=6406071563
OPENCLAW_PORT=18789
```

---

## Deduplication

The consumer watcher tracks processed events in `.seen-events.txt`. The key format is:

```
{event_type}:{from}:{requestId}
```

Example:
```
new_message:consumer:cmmnunxgb0149qh8e548u66ea   ← Sandy's own message (ignored)
new_message:provider:cmmnunxgb0149qh8e548u66ea   ← Provider response (processed ✅)
```

Including `from` ensures that Sandy's outgoing message doesn't block the incoming provider response.

**Stale event protection:** Events older than 30 minutes are added to seen-events without triggering a wake call. This prevents queue flooding when the watcher restarts after downtime.

---

## Scripts Reference

### Consumer side

| Script | Purpose |
|---|---|
| `platform-watcher.sh` | Polls events, wakes Sandy on provider response |
| `submit-request.sh` | Sandy calls this to create a new request |

### Provider side

| Script | Purpose |
|---|---|
| `provider-watcher.sh` | Polls for new requests, notifies Thomas via Telegram |
| `reply-handler.sh` | Processes Thomas's Telegram reply, sends response to HeySummon |
| `setup.sh` | Installs the skill and starts the watcher |
| `teardown.sh` | Stops the watcher |

---

## Running the Watchers

Both watchers use **nohup + pidfile** (not pm2):

```bash
# Start consumer watcher
bash ~/.npm-global/lib/node_modules/openclaw/skills/heysummon/scripts/setup.sh

# Start provider watcher
bash ~/Code/heysummon/skills/openclaw/heysummon-provider/scripts/setup.sh

# Check if running
cat ~/.npm-global/lib/node_modules/openclaw/skills/heysummon/.requests/.watcher.pid
```

> The HeySummon server itself (`pnpm run dev` on port 3425) runs via pm2 as `heysummon`.

---

## Troubleshooting

### Sandy doesn't respond after approval

1. Check consumer watcher is running: `pm2 list | grep heysummon-watcher`
2. Check seen-events for the refCode: `cat .seen-events.txt | grep <requestId>`
3. Check OpenClaw gateway logs: `tail -f /tmp/openclaw/openclaw-$(date +%Y-%m-%d).log`
4. Verify hooks config: `cat ~/.openclaw/openclaw.json | grep -A10 hooks`

### Provider not notified

1. Check provider watcher: `pm2 list | grep heysummon-provider-watcher`
2. Check HeySummon server: `pm2 logs heysummon`
3. Test API: `curl http://localhost:3425/api/v1/events/pending -H "x-api-key: hs_prov_xxx"`

### Gateway crashes on restart

Do **not** set `allowRequestSessionKey: true` without also setting `allowedSessionKeyPrefixes`. The recommended config uses `defaultSessionKey` as the primary routing mechanism.
