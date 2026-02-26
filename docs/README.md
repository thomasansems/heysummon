# HeySummon Documentation

## Getting started

- [Introduction](./introduction.md) — What is HeySummon and how it works
- [Quickstart](./quickstart.md) — Running in 5 minutes

## API Reference

- [Overview](./api/overview.md) — All endpoints, auth, error format, rate limits
- [Submit a request](./api/help-submit.md) — `POST /api/v1/help`
- [Poll a request](./api/help-poll.md) — `GET /api/v1/help/:id`
- [Send a message](./api/message-send.md) — `POST /api/v1/message/:requestId`
- [SSE event stream](./api/events-stream.md) — `GET /api/v1/events/stream`
- [Verify API key](./api/whoami.md) — `GET /api/v1/whoami`

## Guides

- [Provider conversations](./guides/provider-conversations.md) — Respond via Telegram or dashboard
- [API keys](./guides/api-keys.md) — Key types, rotation, scopes, IP allowlisting
- [E2E encryption](./guides/encryption.md) — How encryption works

## Self-hosting

- [Docker](./self-hosting/docker.md) — Recommended for production
- [NPX installer](./self-hosting/npx.md) — Fastest way to get started
- [Architecture](./self-hosting/architecture.md) — Guard, Platform, Mercure, security model
- [Troubleshooting](./TROUBLESHOOTING.md) — Common issues and fixes
