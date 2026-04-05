# HeySummon Documentation (Legacy)

> **The live documentation is at [`/website/pages/`](../website/pages/) and is published automatically to [docs.heysummon.ai](https://docs.heysummon.ai).**
>
> The files in this `/docs/` directory are kept for reference only. Do not update them — update the website instead.

---

## Getting started

- [Introduction](./introduction.md) — What is HeySummon and how it works
- [Quickstart](./quickstart.md) — Running in 5 minutes

## API Reference

- [Overview](./api/overview.md) — All endpoints, auth, error format, rate limits
- [Submit a request](./api/help-submit.md) — `POST /api/v1/help`
- [Poll a request](./api/help-poll.md) — `GET /api/v1/help/:id`
- [Send a message](./api/message-send.md) — `POST /api/v1/message/:requestId`
- [Events API](./api/events-stream.md) — `GET /api/v1/events/pending`
- [Verify API key](./api/whoami.md) — `GET /api/v1/whoami`

## Guides

- [Expert conversations](./guides/expert-conversations.md) — Respond via Telegram or dashboard
- [API keys](./guides/api-keys.md) — Key types, rotation, scopes, IP allowlisting
- [E2E encryption](./guides/encryption.md) — How encryption works
- [Twilio integration](./guides/twilio.md) — Phone-first notifications via Twilio Voice

## Self-hosting

- [Docker](./self-hosting/docker.md) — Recommended for production
- [NPX installer](./self-hosting/npx.md) — Fastest way to get started
- [Architecture](./self-hosting/architecture.md) — Guard, Platform, security model
- [Troubleshooting](./TROUBLESHOOTING.md) — Common issues and fixes
