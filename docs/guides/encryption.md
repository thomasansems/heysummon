# End-to-end encryption

HeySummon uses **hybrid E2E encryption** — the platform stores ciphertext it cannot read. Only the consumer (AI agent) and provider (human expert) can decrypt messages.

---

## Encryption scheme

```
Consumer side:
  1. Generate Ed25519 keypair   → for signing
  2. Generate X25519 keypair    → for encryption

Server side:
  3. Generate RSA-OAEP keypair  → for wrapping session keys

Key exchange:
  4. Consumer sends signPublicKey + encryptPublicKey → POST /api/v1/help
  5. Server sends serverPublicKey → in response
  6. Provider sends their keys   → POST /api/v1/key-exchange/:id

Message encryption:
  7. Derive shared secret via X25519 DH
  8. Encrypt message with AES-256-GCM
  9. Sign ciphertext with Ed25519
```

---

## Simple mode (no encryption)

For quick integrations and testing, omit the public keys and send plaintext:

```json
{
  "apiKey": "hs_live_abc123...",
  "question": "Should I proceed?"
}
```

The platform accepts it and the human sees the question in plain text. **Not recommended for production** — the platform can read your messages.

---

## Encrypted mode

```javascript
import { generateKeyPair, encrypt, sign } from '@heysummon/sdk';

// 1. Generate keypairs
const signKeys = await generateKeyPair('Ed25519');
const encryptKeys = await generateKeyPair('X25519');

// 2. Submit with public keys
const response = await fetch('/api/v1/help', {
  method: 'POST',
  headers: { 'x-api-key': 'hs_live_abc123...' },
  body: JSON.stringify({
    apiKey: 'hs_live_abc123...',
    question: await encrypt('Should I proceed?', serverPublicKey),
    signPublicKey: signKeys.publicKey,
    encryptPublicKey: encryptKeys.publicKey,
  })
});

// 3. Response is encrypted with your public key — only you can decrypt it
const { response: ciphertext } = await pollForResponse(requestId);
const plaintext = await decrypt(ciphertext, encryptKeys.privateKey);
```

---

## What the platform sees

| Data | Stored as | Platform can read? |
|------|-----------|-------------------|
| Question | Ciphertext | ❌ No |
| Response | Ciphertext | ❌ No |
| Messages | Ciphertext | ❌ No |
| Reference code | Plaintext | ✅ Yes |
| Status | Plaintext | ✅ Yes |
| Timestamps | Plaintext | ✅ Yes |

---

## Guard signatures

Every request passes through the **Guard proxy**, which adds an Ed25519 receipt:

```
X-Guard-Receipt: <base64-signature>
```

The platform verifies this header on every request. If `REQUIRE_GUARD=true`, requests without a valid receipt are rejected. This prevents direct API access without going through Guard.
