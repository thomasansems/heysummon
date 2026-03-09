# Message Flow Architecture

This document explains how a message travels through HeySummon — from API submission, through validation, storage, and delivery.

## Overview: The Journey of a Message

```
┌─────────────────────────────────────────────────────────────┐
│              Consumer/Provider sends message                │
│              (via SDK or direct API call)                    │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────┐
│   1. GUARD PROXY - Content Validation & Signing             │
│   • Sanitizes XSS/HTML injection                            │
│   • Detects PII (credit cards, emails, phone numbers)       │
│   • Defangs malicious URLs                                  │
│   • Creates Ed25519 signed receipt                          │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────┐
│   2. PLATFORM API - Authentication & Authorization          │
│   • Verifies Guard receipt signature                        │
│   • Checks x-api-key header                                 │
│   • Validates API key owns the request                      │
│   • Parses + validates message format                       │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────┐
│   3. ENCRYPTION & STORAGE - Message Database                │
│   • Encrypts with AES-256-GCM (E2E)                        │
│   • Stores: ciphertext, IV, authTag, signature              │
│   • Checks for duplicates using messageId                   │
│   • Creates audit log entry                                 │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────┐
│   4. DELIVERY                                               │
│   Provider polls GET /api/v1/events/pending (every 30s)     │
│   Consumer polls GET /api/v1/help/:id                       │
│   Dashboard polls /api/dashboard/stats                      │
└─────────────────┬───────────────────────────────────────────┘
                  │
        ┌────────┬────────┐
        │        │        │
        ▼        ▼        ▼
    DASHBOARD  PROVIDER  CONSUMER
    (Web UI)   WATCHER   (polling)
        │        │
        │        ▼
        │    ┌───────────────────────────┐
        │    │ 5. PROVIDER NOTIFICATION  │
        │    │ • Telegram                │
        │    │ • WhatsApp                │
        │    │ • SMS/Email (future)      │
        │    │ Sends ref code + message  │
        │    └───────┬───────────────────┘
        │            │
        │            ▼
        │    ┌───────────────────────────┐
        │    │ 6. ACKNOWLEDGMENT (ACK)   │
        │    │ POST /api/v1/events/ack   │
        │    │ Provider confirms receipt  │
        │    └───────┬───────────────────┘
        │            │
        │            ▼
        │    ┌───────────────────────────┐
        │    │ Update deliveredAt        │
        │    │ Log audit event           │
        │    └───────┬───────────────────┘
        │            │
        └────────┬───┘
                 │
                 ▼
        ┌──────────────────────────┐
        │ 7. DELIVERY CONFIRMED    │
        │ • Dashboard shows badge  │
        │ • "✓ Delivered"          │
        │ • Timestamp displayed    │
        └──────────────────────────┘
```

---

## Step-by-Step Breakdown

### 1️⃣ Guard Proxy: Content Validation

**File**: `/guard/src/index.ts`, `/guard/src/content-safety.ts`

The Guard is a **reverse proxy** that validates all incoming messages before they reach the Platform.

#### What Guard Does:

- Sanitizes HTML/XSS
- Defangs URLs (https → hxxps)
- Detects & redacts PII (credit cards, SSN, phone numbers)
- Creates Ed25519 signed receipt
- Proxies to Platform with receipt header

#### Detected Patterns:
- **Credit cards** (13-19 digits, Luhn validated) — blocked
- **SSN/BSN** (US: XXX-XX-XXXX, NL: 9 digits) — blocked
- **Email addresses** — redacted
- **Phone numbers** — redacted
- **URLs** — defanged
- **XSS/HTML** — stripped

---

### 2️⃣ Platform API: Authentication & Authorization

**File**: `/src/app/api/v1/message/[requestId]/route.ts`

#### Authentication (Who are you?)

```typescript
const apiKey = request.headers.get("x-api-key");
// Look up key in database, validate it's active
```

**API Key Types**:
- `hs_prov_*` — Provider key (human experts)
- `hs_cli_*` — Consumer key (AI agents)

#### Authorization (Do you have permission?)

- Message `from` field must match caller role
- Providers can only respond to requests assigned to them
- Guard receipt signature must be valid (prevents bypassing Guard)

---

### 3️⃣ Database Storage: Message Model

**File**: `/prisma/schema.prisma`

Messages are stored with E2E encryption:

| Field | Purpose |
|-------|---------|
| `ciphertext` | AES-256-GCM encrypted message content |
| `iv` | Random initialization vector (different per message) |
| `authTag` | GCM authentication tag (prevents tampering) |
| `signature` | Ed25519 signature of ciphertext (proves sender) |
| `messageId` | Unique ID per message (prevents duplicates) |

---

### 4️⃣ Delivery via Polling

After storage, events are made available for polling:

- **Provider watcher** polls `GET /api/v1/events/pending` every 30 seconds
- **Consumer** polls `GET /api/v1/help/:id` when waiting for a response
- **Dashboard** polls for stats/updates

No persistent connections needed — simple HTTP polling ensures reliability.

---

### 5️⃣ Provider Notification

When the provider watcher picks up a new event, it:

1. Formats a notification with the ref code and question
2. Sends it via the configured channel (Telegram, WhatsApp, etc.)
3. Acknowledges delivery via `POST /api/v1/events/ack/:requestId`

---

### 6️⃣ Acknowledgment (ACK)

```bash
POST /api/v1/events/ack/{requestId}
x-api-key: hs_prov_secret123
```

**What happens:**
- Sets `deliveredAt` timestamp on the request
- Logs audit event
- Dashboard shows "✓ Delivered" badge

**Why ACK matters:**

| Scenario | Without ACK | With ACK |
|----------|-------------|----------|
| Watcher crashes before delivery | Unknown status | Platform knows: not delivered |
| Network timeout | Unknown | Clear delivery proof |
| Resend logic | No way to know | Platform can resend if no ACK |

---

## Request Flow

```
AI Agent
  │
  │  POST /api/v1/help (with x-api-key)
  ▼
Guard
  │  Validates key, adds X-Guard-Receipt
  ▼
Platform
  │  Stores encrypted request, generates ref code
  ▼
Provider watcher (polls GET /api/v1/events/pending every 30s)
  │
  │  Human reads, responds
  │  POST /api/v1/message/:id
  ▼
Platform
  │  Updates request status
  ▼
AI Agent (polls GET /api/v1/help/:id)
```

---

## E2E Encryption Flow

```
Consumer (AI Agent)           Platform (blind relay)         Provider (Human)

Generate Ed25519 keypair
Generate X25519 keypair
                    ──── POST /api/v1/help ────▶
                         (signPubKey, encryptPubKey,
                          encrypted question)
                                                ──── poll event ────▶
                    ◀── serverPublicKey ─────────
                                                              Generate keypairs
                                                ◀── POST /key-exchange ──
                    ◀──────────────── response (encrypted) ──────────────
Decrypt with private key
```

The platform only stores ciphertext and never has the private keys to decrypt it.

---

## Security Layers

| Layer | Mechanism | Protects Against |
|-------|-----------|------------------|
| **Guard** | Content validation + Ed25519 signing | Malicious content, XSS, PII exposure |
| **API Key** | Unique per consumer/provider | Unauthorized access |
| **IP Binding** | Provider keys bound to specific IP | Credential theft |
| **Receipt** | Ed25519 signature + timestamp + nonce | Replay attacks, bypassing Guard |
| **Ownership** | Request belongs to provider/consumer | Cross-user access |
| **Encryption** | AES-256-GCM per message | Eavesdropping at rest |
| **Signature** | Ed25519 on ciphertext | Tampering with encrypted content |
| **Audit Log** | Log all API actions + ACK events | Delivery tracking, investigation |

---

## Related Documentation

- [Encryption Model](./security/encryption-model.md) — How E2E encryption works
- [API Overview](./api/overview.md) — All endpoints and auth
- [Security Guide](./guides/api-keys.md) — Managing API keys
- [Architecture](./self-hosting/architecture.md) — System design
