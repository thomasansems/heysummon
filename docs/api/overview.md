# API Overview

HeySummon has two API surfaces:

| Surface | Auth | Who uses it |
|---------|------|-------------|
| **Consumer API** `/api/v1/*` | `x-api-key` (client key) | AI agents, SDKs, integrations |
| **Provider API** `/api/*` | Session cookie or provider key | Dashboard, watcher scripts |

All requests go through the **Guard proxy** in production, which adds Ed25519 signatures. In development without Guard, the platform accepts requests directly.

---

## Base URL

```
http://localhost:3445     # Docker (behind Guard)
http://localhost:3000     # Dev server (direct)
```

---

## Authentication

### Client key (Consumer API)

Include the key in every request:

```bash
-H "x-api-key: hs_live_abc123..."
```

### Provider key (Provider API)

```bash
-H "x-api-key: hs_prov_abc123..."
```

### Session (Dashboard API)

Cookie-based authentication via NextAuth. Use the dashboard or authenticate via `/api/auth/session`.

---

## Error format

All errors return JSON with an `error` field:

```json
{
  "error": "Request not found"
}
```

Common status codes:

| Code | Meaning |
|------|---------|
| `400` | Validation error — check your request body |
| `401` | Missing or invalid API key |
| `403` | Valid key, but not authorized for this resource |
| `404` | Resource not found |
| `429` | Rate limited — back off and retry |
| `500` | Server error |

---

## Rate limits

| Route | Limit |
|-------|-------|
| Dashboard pages | 120 req/min per IP |
| `/api/v1/*` | 60 req/min per IP |
| `/api/v1/help/*` polling | 30 req/min per IP |

Rate limits reset after 60 seconds. Response includes `Retry-After: 60` on 429.

---

## Endpoints

### Consumer API (AI agents)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | [`/api/v1/help`](./help-submit.md) | Submit a help request |
| `GET` | [`/api/v1/help/:id`](./help-poll.md) | Poll status / get response |
| `POST` | [`/api/v1/key-exchange/:requestId`](./key-exchange.md) | Exchange public keys for E2E encryption |
| `POST` | [`/api/v1/message/:requestId`](./message-send.md) | Send a message in a conversation |
| `GET` | [`/api/v1/messages/:requestId`](./messages-list.md) | List messages for a request |
| `GET` | [`/api/v1/events/stream`](./events-stream.md) | SSE stream for real-time updates |
| `POST` | [`/api/v1/events/close/:requestId`](./events-close.md) | Close a request |
| `GET` | [`/api/v1/whoami`](./whoami.md) | Verify your API key |

### Provider API (human experts)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/requests` | List help requests |
| `GET` | `/api/requests/:id` | View and decrypt a request |
| `PATCH` | `/api/requests/:id` | Submit a response |
| `GET` | `/api/keys` | List API keys |
| `POST` | `/api/keys` | Create an API key |
| `DELETE` | `/api/keys/:id` | Delete an API key |
| `POST` | `/api/keys/:id/rotate` | Rotate an API key |
| `GET` | `/api/providers` | List providers |
| `GET` | `/api/audit-logs` | View audit log |
| `POST` | `/api/v1/message/:requestId` | Send a response (provider key) |
