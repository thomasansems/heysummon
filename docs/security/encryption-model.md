# Encryption model

HeySummon uses encryption to protect messages in transit and at rest. This page explains exactly what is and isn't protected — so you can make an informed decision about what data to send through the platform.

---

## Two modes

### Simple mode (plaintext)

The client sends the `question` or `plaintext` fields without encryption.

```json
{
  "apiKey": "hs_live_...",
  "question": "Should I delete the user account?"
}
```

> ⚠️ **In simple mode, the platform operator can read your messages.** The Guard proxy inspects the content for safety (HTML injection, PII, malicious URLs) before forwarding. Messages are stored in the database as plaintext.

Use simple mode for: low-sensitivity requests, internal tooling, testing.

---

### Encrypted mode (server-assisted encryption)

The client generates keypairs and encrypts the message before sending:

```json
{
  "apiKey": "hs_live_...",
  "question": "<encrypted ciphertext>",
  "signPublicKey": "...",
  "encryptPublicKey": "..."
}
```

Messages are encrypted with **RSA-OAEP + AES-256-GCM** before leaving the client.

> ⚠️ **This is server-assisted encryption, not zero-knowledge E2E.** The server generates a keypair per request and stores the private key in the database. The platform can decrypt messages if needed (e.g. to display them in the dashboard for the human expert).

What this protects against:
- ✅ Eavesdropping in transit (combined with TLS)
- ✅ Database dumps (messages are stored as ciphertext)
- ❌ Does not protect against a compromised or malicious platform operator

---

## What the platform stores

| Field | Storage | Platform can read? |
|-------|---------|-------------------|
| `question` (simple mode) | Plaintext | ✅ Yes |
| `question` (encrypted mode) | Ciphertext | ⚠️ Yes — server holds private key |
| `response` (dashboard reply) | Plaintext | ✅ Yes |
| Messages via `/api/v1/message` | Ciphertext | ⚠️ Yes — server holds private key |
| API keys | bcrypt hash | ✅ No — one-way hash |
| Passwords | bcrypt hash | ✅ No — one-way hash |
| Reference codes (`HS-XXXXXXXX`) | Plaintext | ✅ Yes — by design |
| Status, timestamps | Plaintext | ✅ Yes — by design |

---

## Guard proxy and content safety

All requests pass through the **Guard proxy** before reaching the platform.

In simple mode, Guard:
- Validates the API key
- Inspects content for HTML injection, malicious URLs, and PII
- Signs the request with Ed25519 (`X-Guard-Receipt`)

In encrypted mode, Guard:
- Validates the API key
- **Does not inspect ciphertext** — passes it through untouched
- Signs the request with Ed25519

The platform verifies the Ed25519 receipt on every request. When `REQUIRE_GUARD=true`, requests that bypass Guard are rejected.

---

## Self-hosted vs cloud

| | Self-hosted | Cloud |
|---|---|---|
| Who holds the server private key | You | HeySummon (cloud operator) |
| Can platform read your messages | You can (you own the server) | HeySummon team can |
| Recommended for sensitive data | ✅ Yes | ⚠️ Use encrypted mode |

For sensitive data on the cloud, always use encrypted mode and treat the platform as an untrusted relay.

---

## Planned: true zero-knowledge mode

A future version will support **client-side key exchange** (X25519 Diffie-Hellman) where the server never sees the private key. In this mode, the platform is a true blind relay — it stores ciphertext it cannot decrypt.

Track progress: [GitHub issue #102](https://github.com/thomasansems/heysummon/issues/102)
