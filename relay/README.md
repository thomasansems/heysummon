# HITLaaS Relay

End-to-end encrypted message relay service for HITLaaS. Acts as a zero-knowledge intermediary between consumers (AI agents requesting help) and providers (humans answering). Messages are encrypted with RSA-OAEP + AES-256-GCM — the relay never sees plaintext content.

## Architecture

```
Consumer (AI agent)                    Relay                      Provider (human)
       │                                │                              │
       │── POST /relay/send ───────────►│  stores encrypted msgs       │
       │◄── { requestId, refCode } ─────│                              │
       │                                │◄── GET /relay/pending ───────│
       │                                │── list of pending requests ─►│
       │                                │◄── GET /relay/messages/:id ──│
       │                                │── encrypted msgs + key ─────►│
       │                                │◄── POST /relay/respond/:id ──│
       │── GET /relay/status/:id ──────►│                              │
       │◄── { encryptedResponse } ──────│                              │
```

- **SQLite** (better-sqlite3) for persistence — single-file, zero-config
- **RSA-2048** key pairs per session for key exchange
- **AES-256-GCM** for symmetric message encryption
- Sessions auto-expire after 30 minutes

## Getting Started

### Prerequisites

- Node.js 22+
- npm

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
| `POST` | `/api/v1/relay/send` | Key | Consumer sends an encrypted help request |
| `GET` | `/api/v1/relay/status/:id` | No | Poll request status (pending / responded / expired) |
| `GET` | `/api/v1/relay/pending` | Key | Provider lists pending requests (metadata only) |
| `GET` | `/api/v1/relay/messages/:id` | Key | Provider fetches encrypted messages for a request |
| `POST` | `/api/v1/relay/respond/:id` | Key | Provider submits a response |
| `GET` | `/api/v1/relay/stats` | Key | Dashboard stats (counts by status) |
| `POST` | `/api/v1/keys` | No | Create a new API key |

### Example: Send a help request

```bash
curl -X POST http://localhost:4000/api/v1/relay/send \
  -H "Content-Type: application/json" \
  -H "x-api-key: htl_your_key_here" \
  -d '{
    "messages": [
      { "role": "user", "content": "How do I fix this JWT error?" },
      { "role": "assistant", "content": "Let me escalate to a human..." }
    ],
    "question": "secretOrPublicKey must have a value"
  }'
```

### Example: Respond to a request

```bash
curl -X POST http://localhost:4000/api/v1/relay/respond/REQUEST_ID \
  -H "Content-Type: application/json" \
  -H "x-api-key: htl_your_key_here" \
  -d '{ "response": "Set the JWT_SECRET env variable." }'
```

## Testing

```bash
npm test
```

Covers crypto roundtrip (key generation, encrypt/decrypt, unicode, large payloads, wrong-key rejection).

## Docker

```bash
docker build -t hitlaas-relay .
docker run -p 4000:4000 -v relay-data:/app/data hitlaas-relay
```

The image uses a multi-stage build (Node 22 Alpine), persists the SQLite database to `/app/data/`, and includes a built-in health check.

## Deploy to Azure

```bash
./deploy.sh [tag]
```

Builds the Docker image, pushes to Azure Container Registry, and updates the Container App. Requires Terraform outputs from `../infra/` and the Azure CLI.

## Project Structure

```
relay/
├── src/
│   ├── index.ts         # Express server & route handlers
│   ├── db.ts            # SQLite connection & schema init
│   ├── crypto.ts        # RSA-OAEP + AES-256-GCM encryption
│   └── crypto.test.ts   # Crypto unit tests
├── Dockerfile           # Multi-stage production build
├── deploy.sh            # Azure Container Apps deployment
├── package.json
├── tsconfig.json
└── vitest.config.ts
```
