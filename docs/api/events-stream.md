# Poll for events

```
GET /api/v1/events/pending
```

Poll for undelivered events. The provider watcher calls this endpoint every 30 seconds to check for new help requests and status changes.

---

## Request

### Headers

```
x-api-key: hs_prov_abc123...    # provider key
```

---

## Response

```json
{
  "events": [
    {
      "type": "new_request",
      "requestId": "cmxxx...",
      "refCode": "HS-A1B2C3D4",
      "question": "Should I proceed?",
      "createdAt": "2026-03-09T12:00:00.000Z",
      "expiresAt": "2026-03-12T12:00:00.000Z"
    }
  ]
}
```

Returns an empty `events` array when there are no pending events.

---

## Event types

| Event | When it fires | Payload |
|-------|--------------|---------|
| `new_request` | A new help request comes in | `requestId`, `refCode`, `question` |

---

## Acknowledge delivery

After processing an event, acknowledge it so it won't be returned again:

```
POST /api/v1/events/ack/:requestId
```

### Headers

```
x-api-key: hs_prov_abc123...
```

---

## Example (bash polling loop)

```bash
while true; do
  RESULT=$(curl -s http://localhost:3425/api/v1/events/pending \
    -H "x-api-key: hs_prov_abc123...")

  echo "$RESULT" | jq -r '.events[] | "[\(.refCode)] \(.question)"'

  sleep 30
done
```

---

## Rate limits

Polling is limited to **30 requests/min** per IP.
