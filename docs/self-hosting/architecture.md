# Architecture

HeySummon is designed around security, reliable delivery, and zero-knowledge relay.

---

## Components

```
┌──────────────────────────────────────────────────────────┐
│                  Docker internal network                 │
│                                                          │
│  ┌─────────┐    ┌──────────────┐    ┌────────────────┐  │
│  │  Guard  │───▶│   Platform   │───▶│   PostgreSQL   │  │
│  │  :3445  │    │  (Next.js)   │    └────────────────┘  │
│  │ Ed25519 │    │  (internal)  │                        │
│  └─────────┘    └──────────────┘                        │
│       ▲                                                 │
│  ┌─────────┐                                            │
│  │ Tunnel  │  (optional: Cloudflare / Tailscale)        │
│  └─────────┘                                            │
└──────────────────────────────────────────────────────────┘
```

---

## Guard

The single entry point. All external traffic goes through Guard first.

**What Guard does:**
- Validates the `x-api-key` header
- Adds an `X-Guard-Receipt` (Ed25519 signature) to every request
- Proxies to Platform on the internal network

**Why Guard exists:**
- Platform never handles unauthenticated requests
- Every message is cryptographically signed — Platform can verify it came through Guard
- Rate limiting and IP blocking at the edge

---

## Platform (Next.js)

The core application. Runs on an **internal network with no exposed ports**.

- App Router API routes under `/api/*` and `/api/v1/*`
- Dashboard UI for human experts
- Auth via NextAuth.js (email/password + optional OAuth)
- Prisma ORM with PostgreSQL (or SQLite for NPX installs)

---

## Request flow

```
AI Agent
  │
  │  POST /api/v1/help (with x-api-key)
  ▼
Guard
  │  Validates key, adds X-Guard-Receipt
  ▼
Platform
  │  Verifies receipt, stores encrypted request, generates ref code
  ▼
Provider watcher polls GET /api/v1/events/pending
                       │
                       │  Human reads, responds
                       │  PATCH /api/requests/:id (or POST /api/v1/message/:id)
                       ▼
                   Platform
                       │  Updates request status
                       ▼
                   AI Agent polls GET /api/v1/help/:id
```

---

## E2E encryption flow

```
Consumer (AI Agent)           Platform (blind relay)         Provider (Human)

Generate Ed25519 keypair
Generate X25519 keypair
                    ──── POST /api/v1/help ────▶
                         (signPubKey, encryptPubKey,
                          encrypted question)
                                                ──── polling ────▶
                    ◀── serverPublicKey ─────────
                                                              Generate keypairs
                                                ◀── POST /key-exchange ──
                    ◀──────────────── response (encrypted) ──────────────
Decrypt with private key
```

The platform only stores ciphertext and never has the private keys to decrypt it.

---

## Security model

| Threat | Mitigation |
|--------|-----------|
| Unauthenticated requests | Guard validates `x-api-key` before proxying |
| Request forgery | Ed25519 receipts — Platform rejects requests without valid Guard signature |
| Data exposure | E2E encryption — platform stores ciphertext only |
| Brute force | Rate limiting per IP (30-120 req/min depending on route) |
| Key compromise | Key rotation with 24h grace period, IP allowlisting |
| Direct platform access | Platform on internal Docker network, no exposed ports |
