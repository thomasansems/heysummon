# SSE event stream

```
GET /api/v1/events/stream
```

Real-time Server-Sent Events stream. Connect once and receive push notifications when requests are created, updated, or responded to — no polling needed.

---

## Request

### Headers

```
x-api-key: hs_prov_abc123...    # provider key
```

---

## Response

The connection stays open and streams events as they occur:

```
: connected — listening on 1 topic(s)

:

data: {"type":"new_request","requestId":"cmxxx...","refCode":"HS-A1B2C3D4","question":"Should I proceed?"}

:

data: {"type":"status_change","requestId":"cmxxx...","refCode":"HS-A1B2C3D4","status":"responded"}
```

Heartbeat (`:`) lines are sent periodically to keep the connection alive.

---

## Event types

| Event | When it fires | Payload |
|-------|--------------|---------|
| `new_request` | A new help request comes in | `requestId`, `refCode`, `question` |
| `status_change` | Request status changes | `requestId`, `refCode`, `status` |
| `new_message` | A message is sent in a conversation | `requestId`, `refCode`, `messageId`, `from` |

---

## Example (curl)

```bash
curl -N http://localhost:3425/api/v1/events/stream \
  -H "x-api-key: hs_prov_abc123..."
```

---

## Example (JavaScript)

```javascript
const es = new EventSource('/api/v1/events/stream', {
  headers: { 'x-api-key': 'hs_prov_abc123...' }
});

es.onmessage = (event) => {
  const data = JSON.parse(event.data);

  if (data.type === 'new_request') {
    console.log(`New request: [${data.refCode}] ${data.question}`);
  }

  if (data.type === 'status_change' && data.status === 'responded') {
    console.log(`Request ${data.refCode} was answered`);
  }
};

es.onerror = () => {
  console.log('Disconnected — reconnecting...');
};
```

---

## Reconnection

The SSE stream may disconnect after a period of inactivity. Always implement reconnection logic. On reconnect, any events fired during the gap are not replayed — poll pending requests after reconnecting to catch up.
