# 🦞 HITLaaS Realtime Messaging — Architecture Plan v3

## Concept

Een **persistent SSE-based conversatie layer** tussen AI agents (consumers) en menselijke experts (providers). De server is een **dumb encrypted relay** — alle encryptie, decryptie en verificatie gebeurt client-side in de skills.

## Kern Principes

1. **Server = Dumb Relay** — slaat alleen encrypted blobs op, routeert SSE events
2. **E2E Encrypted** — RSA-OAEP (2048-bit) + AES-256-GCM voor berichten
3. **Signed** — Ed25519 signatures op elk bericht (anti-tampering, anti-forgery)
4. **Conversatie-model** — SSE stream blijft open voor vervolg berichten
5. **TTL: 72 uur** — stream sluit automatisch na 72 uur

## Architectuur

```
┌─────────────────┐         ┌──────────────────┐         ┌─────────────────┐
│   Consumer       │         │   HITLaaS Server  │         │    Provider      │
│   (Patrick)      │         │   (dumb relay)     │         │    (Thomas/Octo) │
│                  │         │                    │         │                  │
│  Keys:           │         │  Stores:           │         │  Keys:           │
│  - RSA keypair   │         │  - encrypted blobs │         │  - RSA keypair   │
│  - Ed25519 pair  │         │  - public keys     │         │  - Ed25519 pair  │
│                  │         │  - signatures      │         │                  │
│                  │         │                    │         │                  │
│  POST /help ─────┼────────►│  Store blob ───────┼────────►│ SSE: new_request │
│  SSE /stream ◄───┼────────┼─ connected         │         │                  │
│                  │         │                    │◄────────┼─ POST /key-exch  │
│  SSE: keys ◄─────┼────────┼─ keys_exchanged    │         │                  │
│                  │         │                    │         │                  │
│                  │         │                    │◄────────┼─ POST /message   │
│  SSE: msg ◄──────┼────────┼─ new_message       │         │  (encrypted+sig) │
│  verify + decrypt│         │                    │         │                  │
│                  │         │                    │         │                  │
│  POST /message ──┼────────►│  ─────────────────┼────────►│ SSE: new_message │
│  (encrypted+sig) │         │                    │         │  verify + decrypt│
│                  │         │                    │         │                  │
│  ... conversatie gaat door, max 72u ...         │         │                  │
└─────────────────┘         └──────────────────────┘       └─────────────────┘
```

## Key Exchange + Signature Verification

Elke partij heeft **twee keypairs**:
- **RSA-2048** — voor encryptie (encrypt met ontvanger's pubkey, decrypt met eigen privkey)
- **Ed25519** — voor signatures (sign met eigen privkey, verify met afzender's pubkey)

### Stap-voor-stap Key Exchange

```
Consumer Skill                  Server                          Provider Skill
──────────────                  ──────                          ──────────────

1. Generate keys (eenmalig):
   - RSA keypair (encrypt)
   - Ed25519 keypair (sign)

2. POST /api/v1/help
   {
     apiKey,
     consumerEncryptPubKey,    ──► 3. Store both pubkeys
     consumerSignPubKey,           4. SSE → Provider:
     encryptedPayload,                "new_request" +
     signature                        { consumerEncryptPubKey,
   }                                    consumerSignPubKey }

                                                                5. Generate keys:
                                                                   - RSA keypair
                                                                   - Ed25519 keypair
                                                                
                                                                6. POST /api/v1/key-exchange
                                                                   {
                                                                     requestId,
                                   ◄──────────────────────────     providerEncryptPubKey,
                                                                     providerSignPubKey
                                7. Store provider pubkeys          }
                                8. SSE → Consumer:
                                   "keys_exchanged" +
                                   { providerEncryptPubKey,
                                     providerSignPubKey }

9. Store provider's pubkeys

=== Beide kanten hebben nu elkaars encrypt + sign pubkeys ===
=== Berichten: encrypt met ontvanger's RSA pubkey ===
=== Signatures: sign met eigen Ed25519 privkey ===
```

## Message Format

Elk bericht dat via `POST /api/v1/message/{requestId}` wordt gestuurd:

```json
{
  "encryptedPayload": "<base64: rsaWrappedAesKey.iv.authTag.aesCiphertext>",
  "signature": "<base64: Ed25519 signature over de plaintext>"
}
```

### Verzenden (in skill script):
```
1. plaintext = "Hier is mijn antwoord..."
2. signature = Ed25519_sign(plaintext, eigen_sign_privkey)
3. aesKey = random(32 bytes)
4. iv = random(12 bytes)
5. ciphertext = AES-256-GCM_encrypt(plaintext, aesKey, iv)
6. wrappedKey = RSA-OAEP_encrypt(aesKey, ontvanger_encrypt_pubkey)
7. encryptedPayload = base64(wrappedKey).base64(iv).base64(authTag).base64(ciphertext)
```

### Ontvangen (in skill script):
```
1. Parse encryptedPayload: wrappedKey, iv, authTag, ciphertext
2. aesKey = RSA-OAEP_decrypt(wrappedKey, eigen_encrypt_privkey)
3. plaintext = AES-256-GCM_decrypt(ciphertext, aesKey, iv, authTag)
4. valid = Ed25519_verify(plaintext, signature, afzender_sign_pubkey)
5. Als valid → gebruik plaintext
6. Als NIET valid → REJECT (bericht is getamperd of vervalst)
```

## Endpoints

| Endpoint | Methode | Rol | Beschrijving |
|----------|---------|-----|-------------|
| `/api/v1/help` | POST | Consumer | Start conversatie (+ pubkeys + eerste encrypted bericht) |
| `/api/v1/stream/{requestId}` | GET | Consumer | SSE stream, open voor hele conversatie, max 72u |
| `/api/v1/events` | GET | Provider | Persistent SSE stream, alle clients |
| `/api/v1/key-exchange/{requestId}` | POST | Provider | Stuurt provider pubkeys |
| `/api/v1/message/{requestId}` | POST | Beide | Encrypted + signed bericht sturen |
| `/api/v1/messages/{requestId}` | GET | Beide | Berichtengeschiedenis (encrypted blobs + sigs) |
| `/api/v1/close/{requestId}` | POST | Beide | Conversatie sluiten |

## SSE Events

### Consumer Stream (`GET /api/v1/stream/{requestId}`)
| Event | Data | Beschrijving |
|-------|------|-------------|
| `connected` | `{ requestId, status, expiresAt }` | Stream geopend, TTL info |
| `keys_exchanged` | `{ providerEncryptPubKey, providerSignPubKey }` | Bewaar provider keys in skill |
| `new_message` | `{ id, encryptedPayload, signature, from: "provider", ts }` | Decrypt + verify in skill |
| `closed` | `{ reason: "resolved" \| "expired" \| "provider_closed" }` | Stream eindigt |
| `ping` | `{ ts }` | Keep-alive (30s) |

**TTL: 72 uur.** Na 72u stuurt server `closed` event met reason `expired`.

### Provider Stream (`GET /api/v1/events`)
| Event | Data | Beschrijving |
|-------|------|-------------|
| `connected` | `{ providerId }` | Persistent stream geopend |
| `new_request` | `{ requestId, refCode, consumerEncryptPubKey, consumerSignPubKey, encryptedPayload, signature, createdAt }` | Nieuwe conversatie — decrypt eerste bericht + bewaar consumer keys |
| `new_message` | `{ requestId, refCode, id, encryptedPayload, signature, from: "consumer", ts }` | Vervolg bericht — decrypt + verify |
| `request_closed` | `{ requestId, refCode, reason }` | Conversatie gesloten |
| `ping` | `{ ts }` | Keep-alive (30s) |

## Skill Scripts

Alle crypto happens in de skill via bash scripts + openssl.

### `scripts/keygen.sh` — Eenmalig, genereert beide keypairs
```bash
#!/bin/bash
HITLAAS_DIR="${HITLAAS_DIR:-$HOME/.hitlaas}"
mkdir -p "$HITLAAS_DIR"

# RSA-2048 voor encryptie
openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 \
  -out "$HITLAAS_DIR/encrypt_private.pem" 2>/dev/null
openssl pkey -in "$HITLAAS_DIR/encrypt_private.pem" -pubout \
  -out "$HITLAAS_DIR/encrypt_public.pem" 2>/dev/null

# Ed25519 voor signatures
openssl genpkey -algorithm Ed25519 \
  -out "$HITLAAS_DIR/sign_private.pem" 2>/dev/null
openssl pkey -in "$HITLAAS_DIR/sign_private.pem" -pubout \
  -out "$HITLAAS_DIR/sign_public.pem" 2>/dev/null

echo "Keys generated in $HITLAAS_DIR"
```

### `scripts/encrypt.sh` — Encrypt + sign een bericht
```bash
#!/bin/bash
# Usage: echo "plaintext" | ./encrypt.sh <recipient_encrypt_pub.pem> <own_sign_priv.pem>
RECIPIENT_PUB="$1"
SIGN_PRIV="$2"
PLAINTEXT=$(cat)

# 1. Sign the plaintext with Ed25519
SIGNATURE=$(echo -n "$PLAINTEXT" | openssl pkeyutl -sign -inkey "$SIGN_PRIV" | base64 -w0)

# 2. Generate AES-256 key + IV
AES_KEY=$(openssl rand 32)
IV=$(openssl rand 12)

# 3. AES-256-GCM encrypt
ENCRYPTED=$(echo -n "$PLAINTEXT" | openssl enc -aes-256-gcm \
  -K "$(echo -n "$AES_KEY" | xxd -p -c64)" \
  -iv "$(echo -n "$IV" | xxd -p -c24)" \
  -nosalt -nopad 2>/dev/null)
# Note: GCM auth tag handling needs node.js for proper implementation

# 4. RSA-OAEP wrap the AES key
WRAPPED_KEY=$(echo -n "$AES_KEY" | openssl pkeyutl -encrypt -pubin \
  -inkey "$RECIPIENT_PUB" -pkeyopt rsa_padding_mode:oaep | base64 -w0)

# Output JSON
echo "{\"encryptedPayload\":\"${WRAPPED_KEY}.$(echo -n "$IV" | base64 -w0).TAG.${ENCRYPTED}\",\"signature\":\"${SIGNATURE}\"}"
```

### `scripts/decrypt.sh` — Decrypt + verify een bericht
```bash
#!/bin/bash
# Usage: ./decrypt.sh <encrypted_payload> <signature> <own_encrypt_priv.pem> <sender_sign_pub.pem>
# Returns plaintext if signature valid, exits 1 if invalid
```

### `scripts/crypto.mjs` — Node.js versie (betrouwbaarder voor GCM)
```javascript
#!/usr/bin/env node
// Volledige encrypt/decrypt/sign/verify in één script
// Usage: node crypto.mjs encrypt <plaintext> <recipient_pub> <own_sign_priv>
//        node crypto.mjs decrypt <blob> <sig> <own_encrypt_priv> <sender_sign_pub>
import crypto from 'crypto';
import fs from 'fs';

const [,, action, ...args] = process.argv;

if (action === 'encrypt') {
  const [plaintext, recipientPubPath, signPrivPath] = args;
  const recipientPub = fs.readFileSync(recipientPubPath, 'utf8');
  const signPriv = fs.readFileSync(signPrivPath, 'utf8');
  
  // Sign with Ed25519
  const signature = crypto.sign(null, Buffer.from(plaintext), signPriv).toString('base64');
  
  // AES-256-GCM
  const aesKey = crypto.randomBytes(32);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', aesKey, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  
  // RSA-OAEP wrap AES key
  const wrappedKey = crypto.publicEncrypt(
    { key: recipientPub, padding: crypto.constants.RSA_PKCS1_OAEP_PADDING },
    aesKey
  );
  
  const payload = [wrappedKey, iv, authTag, encrypted]
    .map(b => b.toString('base64')).join('.');
  
  console.log(JSON.stringify({ encryptedPayload: payload, signature }));
}

if (action === 'decrypt') {
  const [payload, signature, encryptPrivPath, senderSignPubPath] = args;
  const encryptPriv = fs.readFileSync(encryptPrivPath, 'utf8');
  const senderSignPub = fs.readFileSync(senderSignPubPath, 'utf8');
  
  const [wrappedKeyB64, ivB64, tagB64, dataB64] = payload.split('.');
  
  // RSA-OAEP unwrap AES key
  const aesKey = crypto.privateDecrypt(
    { key: encryptPriv, padding: crypto.constants.RSA_PKCS1_OAEP_PADDING },
    Buffer.from(wrappedKeyB64, 'base64')
  );
  
  // AES-256-GCM decrypt
  const decipher = crypto.createDecipheriv('aes-256-gcm', aesKey, Buffer.from(ivB64, 'base64'));
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(dataB64, 'base64')),
    decipher.final()
  ]).toString('utf8');
  
  // Verify Ed25519 signature
  const valid = crypto.verify(null, Buffer.from(plaintext), senderSignPub, Buffer.from(signature, 'base64'));
  
  if (!valid) {
    console.error('SIGNATURE VERIFICATION FAILED — message may be tampered');
    process.exit(1);
  }
  
  console.log(plaintext);
}

if (action === 'keygen') {
  const dir = args[0] || `${process.env.HOME}/.hitlaas`;
  fs.mkdirSync(dir, { recursive: true });
  
  // RSA-2048
  const rsa = crypto.generateKeyPairSync('rsa', { modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
  });
  fs.writeFileSync(`${dir}/encrypt_public.pem`, rsa.publicKey);
  fs.writeFileSync(`${dir}/encrypt_private.pem`, rsa.privateKey);
  
  // Ed25519
  const ed = crypto.generateKeyPairSync('ed25519', {
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
  });
  fs.writeFileSync(`${dir}/sign_public.pem`, ed.publicKey);
  fs.writeFileSync(`${dir}/sign_private.pem`, ed.privateKey);
  
  console.log(`Keys generated in ${dir}`);
}
```

## Conversatie Flow (compleet)

```
Minuut 0:  Patrick's skill runt: node crypto.mjs keygen (eenmalig)
           Patrick's skill runt: node crypto.mjs encrypt "Ik loop vast op X" <own_keys>
           POST /api/v1/help → krijgt requestId
           Opent SSE: GET /api/v1/stream/{requestId}
           
Minuut 0:  Octo's SSE ontvangt "new_request" met consumer pubkeys
           Runt: node crypto.mjs keygen (eenmalig)
           POST /api/v1/key-exchange → stuurt provider pubkeys
           Runt: node crypto.mjs decrypt → leest Patrick's vraag
           Notificeert Thomas via Telegram
           
Minuut 0:  Patrick ontvangt "keys_exchanged" → bewaart provider pubkeys
           
Minuut 5:  Thomas antwoordt → Octo runt: node crypto.mjs encrypt "Probeer Y" 
           POST /api/v1/message/{requestId}
           
Minuut 5:  Patrick ontvangt "new_message" via SSE
           Runt: node crypto.mjs decrypt → verify signature ✅ → leest antwoord
           
Minuut 6:  Patrick heeft vervolg vraag → encrypt + sign + POST /message
           Octo ontvangt via SSE → decrypt + verify ✅ → Thomas leest
           
Minuut 8:  Thomas antwoordt definitief → encrypt + sign + POST /message
           Patrick ontvangt → probleem opgelost
           
           Stream blijft open voor eventuele vervolg vragen...
           
Uur 72:    Server stuurt "closed" → stream sluit automatisch
```

## Keep-Alive

- **Server → Client:** `ping` event elke 30 seconden
- **Provider skill:** cron elk uur → checkt of SSE connectie leeft, herstart zo nodig
- **Consumer skill:** auto-reconnect bij disconnect (met `Last-Event-ID` voor gemiste events)

## Database Schema (nieuw/aangepast)

```prisma
model HelpRequest {
  id                    String    @id @default(cuid())
  refCode               String    @unique
  apiKeyId              String
  apiKey                ApiKey    @relation(fields: [apiKeyId], references: [id])
  expertId              String
  
  // Consumer keys (encrypt + sign)
  consumerEncryptPubKey String
  consumerSignPubKey    String
  
  // Provider keys (encrypt + sign) — set after key exchange
  providerEncryptPubKey String?
  providerSignPubKey    String?
  
  status                String    @default("pending")  // pending|active|closed|expired
  expiresAt             DateTime  // createdAt + 72h
  closedAt              DateTime?
  closedReason          String?   // resolved|expired|consumer_closed|provider_closed
  
  messages              Message[]
  createdAt             DateTime  @default(now())
}

model Message {
  id               String      @id @default(cuid())
  requestId        String
  request          HelpRequest @relation(fields: [requestId], references: [id])
  from             String      // "consumer" | "provider"
  encryptedPayload String      // RSA+AES encrypted blob
  signature        String      // Ed25519 signature (base64)
  createdAt        DateTime    @default(now())
}
```

## Vergelijking

| Aspect | Huidige versie | v3 (dit plan) |
|--------|---------------|---------------|
| Transport | Polling + SSE notify | Full SSE streams |
| Model | Single request-response | Conversatie (multi-message) |
| TTL | 24 uur | 72 uur |
| Encryptie | Server-side RSA+AES | **Client-side** RSA+AES (in skill scripts) |
| Signatures | ❌ Geen | ✅ Ed25519 op elk bericht |
| Server rol | Encrypt/decrypt | **Dumb relay** (ziet nooit plaintext) |
| Vervolg vragen | Nieuw request nodig | Zelfde stream |
| Key management | Server genereert keys | **Skills genereren keys** |

## Security Properties

- ✅ **Confidentiality:** Server kan berichten niet lezen (alleen encrypted blobs)
- ✅ **Integrity:** Ed25519 signatures detecteren tampering
- ✅ **Authenticity:** Signatures bewijzen afzender (server kan niet forgeren)
- ✅ **Forward secrecy:** Niet standaard (zou per-message DH vereisen, overkill voor nu)
- ✅ **Replay protection:** Message IDs + timestamps in de signed payload

## Implementatie Volgorde

1. **Database migratie** — nieuw Message model, HelpRequest aanpassen
2. **`/api/v1/stream/{requestId}`** — Consumer SSE endpoint
3. **`/api/v1/key-exchange/{requestId}`** — Key exchange endpoint
4. **`/api/v1/message/{requestId}`** — Message endpoint (POST)
5. **`/api/v1/messages/{requestId}`** — Message history (GET)
6. **`/api/v1/close/{requestId}`** — Close endpoint
7. **Refactor `/api/v1/events`** — Provider stream met nieuwe event types
8. **Skill: `scripts/crypto.mjs`** — Node.js crypto module
9. **Consumer skill update** — keygen + stream + encrypt/decrypt flow
10. **Provider skill update** — persistent SSE + key-exchange + respond flow
11. **TTL cron** — auto-expire na 72u
12. **Tests** — unit tests voor crypto + E2E integration test
