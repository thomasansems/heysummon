# Submit a help request

```
POST /api/v1/help
```

Sends a help request from an AI agent to a human expert. Returns a request ID and reference code immediately. The human expert is notified in real time.

---

## Request

### Headers

```
x-api-key: hs_live_abc123...
Content-Type: application/json
```

### Body

```json
{
  "apiKey": "hs_live_abc123...",
  "question": "Should I delete the user's account permanently?",
  "signPublicKey": "base64-encoded-public-key",
  "encryptPublicKey": "base64-encoded-public-key",
  "messages": "encrypted-conversation-history",
  "messageCount": 5
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `apiKey` | string | ✅ | Your client API key |
| `question` | string | ✅ | The question or request for the human. Encrypted before sending. |
| `signPublicKey` | string | ✅ | Ed25519 public key for message signing |
| `encryptPublicKey` | string | ✅ | X25519 public key for encryption |
| `messages` | string | ❌ | Encrypted conversation history (for context) |
| `messageCount` | number | ❌ | Number of messages in `messages` |

> **Simple mode (unencrypted):** Omit `signPublicKey` and `encryptPublicKey` to send a plaintext request. The platform will handle it, but E2E encryption is disabled.

---

## Response

```json
{
  "requestId": "cmxxx...",
  "refCode": "HS-A1B2C3D4",
  "status": "pending",
  "serverPublicKey": "base64-encoded-server-public-key",
  "expiresAt": "2026-02-27T21:00:00.000Z"
}
```

| Field | Description |
|-------|-------------|
| `requestId` | UUID — use this to poll for the response |
| `refCode` | 8-character reference code (`HS-XXXXXXXX`) — shown to the human expert |
| `status` | Always `pending` on creation |
| `serverPublicKey` | Server's public key for E2E encryption |
| `expiresAt` | Request auto-expires after 72 hours (configurable) |

---

## Example

```bash
curl -X POST https://your-instance.com/api/v1/help \
  -H "Content-Type: application/json" \
  -H "x-api-key: hs_live_abc123..." \
  -d '{
    "apiKey": "hs_live_abc123...",
    "question": "The user wants to delete their account. Should I proceed?",
    "signPublicKey": "...",
    "encryptPublicKey": "..."
  }'
```

---

## What happens next

1. The human expert sees the request in their dashboard (and gets notified via any connected channel)
2. They respond — the status changes to `responded`
3. You poll `GET /api/v1/help/:id` or listen on the SSE stream to get the response

---

## Request lifecycle

```
pending  →  reviewing  →  responded
    └──────────────────────→  expired  (after TTL)
```

| Status | Meaning |
|--------|---------|
| `pending` | Submitted, waiting for a human to open it |
| `reviewing` | Human has opened the request |
| `responded` | Human has replied |
| `expired` | TTL elapsed (default 72h) |
| `closed` | Manually closed via `/api/v1/events/close/:id` |
