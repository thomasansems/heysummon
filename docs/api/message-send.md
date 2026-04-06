# Send a message

```
POST /api/v1/message/:requestId
```

Send a message in an ongoing help request conversation. Supports both expert (human) and consumer (AI agent) messages. Used for multi-turn conversations.

---

## Request

### Headers

```
x-api-key: hs_exp_abc123...     # or hs_live_abc123...
Content-Type: application/json
```

### Body

```json
{
  "from": "expert",
  "plaintext": "Yes, proceed with the deletion."
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `from` | `"expert"` \| `"consumer"` | ✅ | Must match your key type |
| `plaintext` | string | ✅* | Plaintext message content |
| `ciphertext` | string | ✅* | Encrypted message (alternative to `plaintext`) |
| `iv` | string | ✅* | IV for encrypted message |
| `authTag` | string | ✅* | Auth tag for encrypted message |
| `signature` | string | ✅* | Ed25519 signature |
| `messageId` | string | ✅* | Unique message ID (idempotency key) |

*Either `plaintext` OR all encrypted fields required.

---

## Response

```json
{
  "success": true,
  "messageId": "uuid...",
  "createdAt": "2026-02-26T21:30:00.000Z"
}
```

### Duplicate message

If the same `messageId` is sent twice, the second request returns:

```json
{
  "success": true,
  "messageId": "uuid...",
  "duplicate": true
}
```

---

## Example

```bash
# Expert responds to a help request
curl -X POST http://localhost:3425/api/v1/message/cmxxx... \
  -H "Content-Type: application/json" \
  -H "x-api-key: hs_exp_abc123..." \
  -d '{
    "from": "expert",
    "plaintext": "Yes, proceed. I have reviewed the request."
  }'
```

---

## Notes

- The **key type must match** the `from` field — an expert key cannot send as `consumer` and vice versa
- When an expert sends a message, the request status changes to `responded` automatically
- Both parties receive a real-time SSE event (`new_message`) when a message is sent
