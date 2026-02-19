# HITLaaS Relay

End-to-end encrypted message relay service for HITLaaS. Acts as a zero-knowledge intermediary between consumers (AI agents requesting help) and providers (humans answering).

**Polling-based** — no webhooks needed. Both consumers and providers use simple HTTP polling to check for updates. This means neither side needs a publicly accessible URL.

## Architecture

```
Consumer (AI agent)                    Relay                      Provider (human)
       │                                │                              │
       │── POST /relay/send ───────────►│  stores encrypted msgs       │
       │◄── { requestId, refCode } ─────│                              │
       │                                │                              │
       │                                │◄── GET /relay/pending ───────│
       │                                │── list of pending requests ─►│
       │                                │                              │
       │                                │◄── GET /relay/messages/:id ──│
       │                                │── encrypted msgs ───────────►│
       │                                │                              │
       │                                │◄── POST /relay/respond/:id ──│
       │                                │                              │
       │── GET /relay/status/:id ──────►│  (poll for response)         │
       │◄── { status, encResponse } ────│                              │
```

## Key Design Decisions

- **No webhooks** — purely polling-based. No public URLs needed.
- **E2E encrypted** — relay stores only ciphertext, never sees plaintext.
- **Zero-knowledge** — relay cannot decrypt messages or responses.
- **Simple** — just REST endpoints, no WebSockets, no complex protocols.
- **SQLite** (better-sqlite3) for persistence — single-file, zero-config.
- **RSA-2048** key pairs per session for key exchange.
- **AES-256-GCM** for symmetric message encryption.
- Requests auto-expire after 24 hours.

## Consumer Polling Strategy

The consumer uses **smart two-phase polling**:

1. **Phase 1 (first hour)**: Poll every 10 seconds for fast response times
2. **Phase 2 (after 1 hour)**: Create an OpenClaw cron job that polls every 5 minutes

This balances responsiveness with resource efficiency.

## Getting Started

### Prerequisites
- Node.js 22+

### Install & Run
```bash
npm install
npm run dev     # starts on port 4000 with hot reload
```

### Environment Variables

| Variable | Default | Description |
|---|---|---|
| `PORT` | `4000` | Server port |
| `CORS_ORIGIN` | `*` | Allowed CORS origin |
| `RELAY_DB_PATH` | `./data/relay.db` | SQLite database path |

## API Endpoints

All endpoints under `/api/v1/relay/`. Protected endpoints require an `x-api-key` header.

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/health` | No | Health check |
| `POST` | `/api/v1/relay/send` | Key | Consumer sends encrypted help request |
| `GET` | `/api/v1/relay/status/:id` | No | Poll request status + encrypted response |
| `GET` | `/api/v1/relay/pending` | Key | Provider lists pending requests (metadata only) |
| `GET` | `/api/v1/relay/messages/:id` | Key | Provider fetches encrypted messages |
| `POST` | `/api/v1/relay/respond/:id` | Key | Provider submits response |
| `GET` | `/api/v1/relay/stats` | Key | Dashboard stats |
| `POST` | `/api/v1/keys` | No | Create a new API key |

### Example: Submit a help request

```bash
curl -X POST http://localhost:4000/api/v1/relay/send \
  -H "Content-Type: application/json" \
  -H "x-api-key: htl_your_key" \
  -d '{
    "publicKey": "-----BEGIN PUBLIC KEY-----\n...",
    "messages": [
      { "role": "user", "content": "How do I fix this JWT error?" },
      { "role": "assistant", "content": "Let me escalate to a human..." }
    ],
    "question": "secretOrPublicKey must have a value"
  }'
```

### Example: Poll for response

```bash
# Returns encryptedResponse when status = "responded"
curl http://localhost:4000/api/v1/relay/status/REQUEST_ID
```

### Example: Respond to a request

```bash
curl -X POST http://localhost:4000/api/v1/relay/respond/REQUEST_ID \
  -H "Content-Type: application/json" \
  -H "x-api-key: htl_your_key" \
  -d '{ "response": "Set the JWT_SECRET env variable." }'
```

## Docker

```bash
docker build -t hitlaas-relay .
docker run -p 4000:4000 -v relay-data:/app/data hitlaas-relay
```

## Project Structure

```
relay/
├── src/
│   ├── index.ts         # Express server & route handlers
│   ├── db.ts            # SQLite connection & schema init
│   ├── crypto.ts        # RSA-OAEP + AES-256-GCM encryption
│   └── crypto.test.ts   # Crypto unit tests
├── Dockerfile           # Multi-stage production build
├── package.json
└── tsconfig.json
```
