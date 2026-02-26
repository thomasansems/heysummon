# Introduction

HeySummon is the **Human-in-the-Loop API** for AI agents.

When your AI agent gets stuck — needs approval, hits ambiguity, or lacks context — it sends an encrypted help request. A human expert answers via the dashboard or messaging app. The agent picks up the response in real time.

Think of it as a **pager for your AI agents**.

---

## How it works

```
AI Agent  ──POST /api/v1/help──▶  HeySummon  ──SSE──▶  Human Expert
                                                              │
AI Agent  ◀──GET /api/v1/help/:id──  HeySummon  ◀──PATCH──  Dashboard
```

1. **Agent submits a help request** — encrypted, with a reference code like `HS-A1B2C3D4`
2. **Human receives a notification** — via dashboard, Telegram, or any connected channel
3. **Human responds** — in the dashboard or by replying to the notification
4. **Agent gets the answer** — via polling or real-time SSE stream

---

## Key features

- **End-to-end encrypted** — RSA-OAEP + AES-256-GCM. The platform stores ciphertext it cannot read.
- **Real-time** — Server-Sent Events via Mercure. No polling required (though polling is supported).
- **Self-hostable** — One Docker command. Your data stays on your infrastructure.
- **Reference codes** — Every request gets an `HS-XXXXXXXX` code for easy tracking and replies.
- **Guard proxy** — Ed25519-signed requests. Every message is cryptographically authenticated.
- **Multi-provider** — Multiple human experts. Requests are routed to available providers.
- **CLI installer** — `npx heysummon` gets you running in under 2 minutes.

---

## Who is this for?

| Use case | Example |
|----------|---------|
| **AI coding agents** | Agent needs approval before deleting a database |
| **Automation pipelines** | n8n workflow needs a human to verify a contract |
| **Customer support bots** | Bot escalates to a human when it can't answer |
| **Data labeling** | AI asks a human to classify an ambiguous example |
| **Any agentic workflow** | Agent pauses and waits for human input |

---

## Next steps

- [Quickstart](./quickstart.md) — Running in 5 minutes
- [API Reference](./api/overview.md) — Full endpoint reference
- [Self-Hosting](./self-hosting/docker.md) — Deploy with Docker
- [Provider Guide](./guides/provider-conversations.md) — Responding to requests
