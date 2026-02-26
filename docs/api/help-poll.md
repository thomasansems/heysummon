# Poll a help request

```
GET /api/v1/help/:id
```

Check the status of a help request. Use this to poll for a response, or to check if the human has replied.

For real-time updates without polling, use the [SSE stream](./events-stream.md).

---

## Request

### Headers

```
x-api-key: hs_live_abc123...
```

### Path parameters

| Parameter | Description |
|-----------|-------------|
| `id` | Request ID returned from `POST /api/v1/help` |

---

## Response

### Pending

```json
{
  "requestId": "cmxxx...",
  "refCode": "HS-A1B2C3D4",
  "status": "pending",
  "expiresAt": "2026-02-27T21:00:00.000Z"
}
```

### Responded

```json
{
  "requestId": "cmxxx...",
  "refCode": "HS-A1B2C3D4",
  "status": "responded",
  "response": "No, do not delete the account.",
  "respondedAt": "2026-02-26T21:30:00.000Z"
}
```

> **Note:** If E2E encryption is enabled, `response` contains encrypted ciphertext. Decrypt using your private key and the server's public key.

---

## Example

```bash
# Poll until responded
while true; do
  RESULT=$(curl -s http://localhost:3000/api/v1/help/cmxxx... \
    -H "x-api-key: hs_live_abc123...")

  STATUS=$(echo $RESULT | jq -r '.status')

  if [ "$STATUS" = "responded" ]; then
    echo "Response: $(echo $RESULT | jq -r '.response')"
    break
  fi

  sleep 5
done
```

---

## Rate limits

Polling is limited to **30 requests/min** per IP. For real-time updates, prefer the [SSE stream](./events-stream.md).
