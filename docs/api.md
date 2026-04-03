# HeySummon API Reference

All endpoints are relative to your HeySummon base URL (e.g. `https://your-instance.example.com`).

---

## Authentication

### Client API Key (Consumer endpoints)

Include in every request:

```
x-api-key: hs_cli_...
```

Keys are created from the dashboard under **Clients**. Keys start with `hs_cli_`.

IP binding is enforced: first request from a new IP is auto-approved; subsequent new IPs require dashboard approval.

### Session (Dashboard/Provider endpoints)

Session-based via NextAuth.js. Pass the cookie returned by `POST /api/auth/signin`. Not applicable for programmatic consumer access.

---

## Rate Limits

- **Consumer polling** (`GET /api/v1/events/pending`): No hard rate limit; respect the 5-second default interval.
- **Request submission** (`POST /api/v1/help`): 150 requests/minute per API key.
- **Exceeded**: `429 Too Many Requests`.

---

## Consumer API

Used by AI agents (OpenClaw, Claude Code) to submit and track help requests.

### POST /api/v1/help

Submit a help request to a human expert.

**Auth:** `x-api-key`

**Request:**
```json
{
  "apiKey": "hs_cli_...",
  "question": "How do I configure X?",
  "messages": [
    { "role": "user", "content": "Context: ..." }
  ],
  "signPublicKey": "-----BEGIN PUBLIC KEY-----\n...",
  "encryptPublicKey": "-----BEGIN PUBLIC KEY-----\n...",
  "providerName": "Alice",
  "requiresApproval": false
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `question` | string | Yes | The question for the expert |
| `messages` | array | No | Conversation context |
| `signPublicKey` | string | No | Ed25519 public key for E2E signing |
| `encryptPublicKey` | string | No | X25519 public key for E2E encryption |
| `providerName` | string | No | Route to a specific named provider |
| `requiresApproval` | boolean | No | If true, provider must approve before responding |

**Response `200`:**
```json
{
  "requestId": "cm...",
  "refCode": "HS-ABCD",
  "status": "pending",
  "expiresAt": "2026-01-01T01:00:00Z",
  "providerUnavailable": false,
  "serverPublicKey": "-----BEGIN PUBLIC KEY-----\n..."
}
```

**Errors:**
- `400` — Missing required fields
- `401` — Invalid or expired API key
- `403` — IP not approved
- `429` — Rate limit exceeded

---

### GET /api/v1/help/:requestId

Check the status of a submitted request.

**Auth:** `x-api-key`

**Response `200`:**
```json
{
  "request": {
    "status": "responded",
    "refCode": "HS-ABCD"
  }
}
```

**Status values:**

| Status | Meaning |
|--------|---------|
| `pending` | Submitted, waiting for provider to pick up |
| `active` | Provider has started working on it |
| `responded` | Provider has replied |
| `closed` | Conversation ended |
| `expired` | Request expired without a response |

---

### GET /api/v1/events/pending

Poll for pending events. Updates `lastPollAt` on the API key (used for connection verification).

**Auth:** `x-api-key`

**Response `200`:**
```json
{
  "events": [
    {
      "type": "new_message",
      "requestId": "cm...",
      "refCode": "HS-ABCD",
      "from": "provider",
      "messageCount": 3,
      "latestMessageAt": "2026-01-01T00:05:00Z"
    }
  ]
}
```

**Event types:**

| Type | Meaning |
|------|---------|
| `new_request` | A new help request arrived (provider-side) |
| `new_message` | A new message was added to a request |

---

### POST /api/v1/events/ack/:requestId

Acknowledge an event. Marks it as processed so it won't appear in subsequent polls.

**Auth:** `x-api-key`

**Response `200`:** `{}`

---

### GET /api/v1/messages/:requestId

Fetch the full message history for a request.

**Auth:** `x-api-key`

**Response `200`:**
```json
{
  "messages": [
    {
      "id": "msg...",
      "messageId": "msgid...",
      "from": "provider",
      "ciphertext": "base64...",
      "iv": "base64...",
      "authTag": "base64...",
      "signature": "base64...",
      "createdAt": "2026-01-01T00:05:00Z"
    }
  ]
}
```

> **Note:** Messages are E2E encrypted. `ciphertext` is base64-encoded AES-256-GCM ciphertext. Only the consumer holding the private key can decrypt. Exception: if `iv === "plaintext"`, the ciphertext is unencrypted (base64 UTF-8 string) — used in non-E2E flows.

---

### GET /api/v1/whoami

Identify which provider this API key is linked to.

**Auth:** `x-api-key`

**Response `200`:**
```json
{
  "keyId": "cm...",
  "keyName": "My Agent Key",
  "provider": {
    "id": "cm...",
    "name": "Alice's Platform",
    "isActive": true
  },
  "expert": {
    "id": "cm...",
    "name": "Alice"
  }
}
```

---

### GET /api/v1/providers

List the provider linked to this API key.

**Auth:** `x-api-key`

**Response `200`:**
```json
{
  "providers": [
    {
      "id": "cm...",
      "name": "Alice's Platform",
      "isActive": true
    }
  ]
}
```

---

### POST /api/v1/setup/verify

Check whether a consumer API key has polled recently (used for setup page live verification).

**Auth:** Dashboard session (provider must be logged in)

**Request:**
```json
{ "keyId": "cm..." }
```

**Response `200`:**
```json
{
  "connected": true,
  "lastPollAt": "2026-01-01T00:00:28Z",
  "lastPollAgoMs": 4200,
  "allowedIps": ["127.0.0.1", "203.0.113.42"]
}
```

`connected: true` means `lastPollAt` is within the last 30 seconds.

**Errors:**
- `401` — Not authenticated (dashboard session required)
- `400` — Missing `keyId`
- `404` — Key not found or belongs to another user

---

## Provider API (Dashboard)

Used by the dashboard UI. Session-authenticated. Not intended for direct programmatic access.

### POST /api/v1/message/:requestId

Send a reply to a consumer's help request.

**Auth:** `x-api-key` (provider key)

**Request:**
```json
{
  "from": "provider",
  "plaintext": "Here is my response..."
}
```

**Response `200`:**
```json
{ "success": true }
```

---

## Adapters

### POST /api/adapters/telegram/:channelId/webhook

Telegram webhook endpoint. Receives updates from Telegram's servers and processes bot commands.

**Auth:** `x-telegram-bot-api-secret-token` header (set during channel setup)

**Supported commands:**

| Command | Description |
|---------|-------------|
| `/reply HS-XXXX <text>` | Reply to a help request by ref code |
| `/start` | Display help |

---

## Error Codes

| HTTP Status | Meaning |
|-------------|---------|
| `400` | Bad request — missing or invalid fields |
| `401` | Authentication required or API key invalid |
| `403` | Forbidden — IP not approved, wrong key type, or scope insufficient |
| `404` | Resource not found |
| `429` | Rate limit exceeded |
| `500` | Server error — try again |

Error responses always include a JSON body:
```json
{ "error": "Description of what went wrong" }
```

---

## Polling Best Practices

1. **Default interval:** 5 seconds (`HEYSUMMON_POLL_INTERVAL=5`)
2. **Acknowledge events** after processing them — prevents re-delivery
3. **Deduplicate** by `requestId + type + latestMessageAt` — the server may return the same event multiple times until acked
4. **Backoff on error** — if the endpoint returns 5xx, wait 30s before retrying
5. **Don't poll faster than 2s** — the server updates heartbeat on each poll; excessive polling wastes resources

---

## TypeScript SDK

The `@heysummon/consumer-sdk` package provides typed wrappers for all consumer endpoints:

```bash
pnpm install @heysummon/consumer-sdk
```

```typescript
import { HeySummonClient, PollingWatcher, ProviderStore } from "@heysummon/consumer-sdk";

const client = new HeySummonClient({ baseUrl: "https://...", apiKey: "hs_cli_..." });

const watcher = new PollingWatcher({
  client,
  pollIntervalMs: 5000,
  onEvent: async (event) => {
    if (event.type === "new_message") {
      const { messages } = await client.getMessages(event.requestId);
      // handle response...
    }
  },
  onError: (err) => console.error("Poll error:", err),
});

watcher.start();
```
