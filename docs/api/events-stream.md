# Polling API

Experts poll for pending events and acknowledge delivery. No persistent connections needed.

---

## GET /api/v1/events/pending

Returns pending events for the authenticated expert.

### Headers

```
x-api-key: hs_exp_abc123...     # expert key
```

### Response

```json
{
  "events": [
    {
      "type": "new_request",
      "requestId": "cmxxx...",
      "refCode": "HS-A1B2C3D4",
      "question": "Should I proceed?",
      "status": "pending",
      "createdAt": "2026-02-28T09:00:00Z",
      "expiresAt": "2026-03-03T09:00:00Z"
    }
  ]
}
```

Returns up to 50 undelivered requests assigned to the authenticated expert.

### Example (curl)

```bash
curl http://localhost:3425/api/v1/events/pending \
  -H "x-api-key: hs_exp_abc123..."
```

---

## GET /api/v1/events/ack/:id

Acknowledge delivery of an event. Call this after successfully processing a pending event.

### Headers

```
x-api-key: hs_exp_abc123...     # expert key
```

### Response

```json
{
  "ok": true,
  "deliveredAt": "2026-02-28T10:30:45.000Z"
}
```

### Example (curl)

```bash
curl http://localhost:3425/api/v1/events/ack/cmxxx... \
  -H "x-api-key: hs_exp_abc123..."
```

---

## Typical polling flow

1. Poll `GET /api/v1/events/pending` on an interval (e.g. every 5 seconds)
2. Process each returned event (send notification, etc.)
3. Acknowledge each event with `GET /api/v1/events/ack/:id`
4. Repeat
