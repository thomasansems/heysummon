# 🦞 HITLaaS Realtime Messaging — Architecture Plan v4
## Mercure Hub + Olm-inspired E2E Encryption

---

## Onderzoeksresultaten

### Mercure — Wat het is en waarom het past

Mercure is een open-source **SSE-based pub/sub protocol** met een Go hub (gebouwd op Caddy). Het is precies wat wij nodig hebben:

**Wat Mercure biedt dat wij nu handmatig bouwen:**
- ✅ **Topic-based routing** — subscribers luisteren op specifieke topics (bijv. `/requests/{id}`)
- ✅ **Private updates** — JWT-based auth bepaalt wie welke topics mag zien
- ✅ **Reconciliation** — `Last-Event-ID` header zodat gemiste berichten bij reconnect worden opgehaald
- ✅ **History** — hub slaat events op in BoltDB, subscribers krijgen gemiste events terug
- ✅ **Heartbeat** — configureerbare keep-alive (default 40s)
- ✅ **Auto-reconnect** — native `EventSource` doet dit automatisch
- ✅ **Encryption spec** — Mercure spec heeft een encryptie sectie (JWE-based)
- ✅ **Docker image** — `dunglas/mercure`, klaar voor productie
- ✅ **Node.js library** — `node-mercure` voor publishing vanuit Next.js

**Wat wij NIET meer zelf hoeven te bouwen:**
- ❌ Geen eigen SSE stream management
- ❌ Geen eigen keep-alive/ping logic
- ❌ Geen eigen reconnect + missed event recovery
- ❌ Geen eigen event bus (EventEmitter)

**Wat wij WEL zelf doen:**
- E2E encryptie (Mercure's JWE is server-side, wij willen client-side)
- Message persistence (in onze DB, niet Mercure's BoltDB)
- Key exchange protocol
- Dashboard integratie

### Olm/Megolm — Analyse

Olm (nu vervangen door **vodozemac** in Rust) is Matrix's E2E crypto library:

**Hoe Olm werkt:**
1. **Ed25519 fingerprint key** — identificeert een device, signeert alles
2. **Curve25519 identity key** — voor Diffie-Hellman key exchange
3. **Curve25519 one-time keys** — voor initiële sessie setup (X3DH-achtig)
4. **Double Ratchet** — elke message heeft een nieuwe symmetric key (forward secrecy)
5. **Megolm** — group variant: één ratchet key gedeeld met de groep

**Past Olm bij HITLaaS?**

| Aspect | Olm/Megolm | HITLaaS behoefte |
|--------|-----------|-----------------|
| Forward secrecy | ✅ Per-bericht | Nice-to-have, niet kritisch |
| Multi-device | ✅ Per-device keys | Niet nodig (1 agent = 1 device) |
| Group messaging | ✅ Megolm | Niet nodig (1-op-1) |
| Complexiteit | Zeer hoog | Willen we simpel houden |
| Dependencies | vodozemac (Rust/WASM) | Moet in bash/node skill werken |
| Key management | Complex (one-time keys, device verification) | Willen we simpel |

**Conclusie: Olm is overkill voor HITLaaS.**

Olm is ontworpen voor een heel ander scenario: duizenden devices, groepschats, lange levensduur. HITLaaS heeft 1-op-1 conversaties van max 72 uur tussen twee partijen.

**Wat we WEL van Olm overnemen:**
- ✅ **Ed25519** voor signatures (Olm's fingerprint key)
- ✅ **Key exchange vóór eerste bericht** (Olm's session setup)
- ✅ **Signature op elk bericht** (Olm signeert alles met Ed25519)

**Wat we NIET overnemen:**
- ❌ Double Ratchet (overkill, sessies zijn max 72u)
- ❌ One-time keys (niet nodig bij direct key exchange)
- ❌ Megolm (geen groepschats)
- ❌ vodozemac dependency (te zwaar voor skill scripts)

---

## Architecture: Mercure Hub + Custom E2E

```
┌─────────────────┐       ┌──────────────┐       ┌──────────────┐       ┌─────────────────┐
│   Consumer       │       │  HITLaaS API  │       │  Mercure Hub  │       │    Provider      │
│   (Patrick)      │       │  (Next.js)    │       │  (Docker)     │       │    (Thomas/Octo) │
│                  │       │               │       │               │       │                  │
│  Skill:          │       │  Stores:      │       │  Routes:      │       │  Skill:          │
│  - encrypt.mjs   │       │  - messages   │       │  - SSE events │       │  - decrypt.mjs   │
│  - Ed25519 sign  │       │  - keys       │       │  - history    │       │  - Ed25519 verify│
│  - EventSource   │       │  - sessions   │       │  - reconnect  │       │  - EventSource   │
└────────┬─────────┘       └──────┬───────┘       └──────┬────────┘       └────────┬─────────┘
         │                        │                       │                         │
         │  1. POST /api/v1/help  │                       │                         │
         │  (encrypted+signed)    │                       │                         │
         ├───────────────────────►│                       │                         │
         │                        │  2. Publish to topic   │                         │
         │                        │  /requests/{provider}  │                         │
         │                        ├──────────────────────►│                         │
         │                        │                       │  3. SSE push            │
         │                        │                       │  "new_request"          │
         │                        │                       ├────────────────────────►│
         │                        │                       │                         │
         │                        │                       │  4. POST /key-exchange  │
         │                        │◄──────────────────────┼─────────────────────────┤
         │                        │                       │                         │
         │                        │  5. Publish to topic   │                         │
         │                        │  /stream/{requestId}   │                         │
         │                        ├──────────────────────►│                         │
         │  6. SSE push           │                       │                         │
         │  "keys_exchanged"      │                       │                         │
         │◄───────────────────────┼───────────────────────┤                         │
         │                        │                       │                         │
         │                        │                       │  7. POST /message       │
         │                        │◄──────────────────────┼─────────────────────────┤
         │                        │  8. Publish            │                         │
         │                        ├──────────────────────►│                         │
         │  9. SSE: "new_message" │                       │                         │
         │  (encrypted+signed)    │                       │                         │
         │◄───────────────────────┼───────────────────────┤                         │
         │                        │                       │                         │
         │  10. POST /message     │                       │                         │
         │  (encrypted+signed)    │                       │                         │
         ├───────────────────────►│  11. Publish           │                         │
         │                        ├──────────────────────►│                         │
         │                        │                       │  12. SSE: "new_message" │
         │                        │                       ├────────────────────────►│
```

## Componenten

### 1. Mercure Hub (Docker sidecar)

```yaml
# docker-compose.yml toevoeging
mercure:
  image: dunglas/mercure
  restart: unless-stopped
  environment:
    SERVER_NAME: ':3000'
    MERCURE_PUBLISHER_JWT_KEY: '${MERCURE_JWT_SECRET}'
    MERCURE_SUBSCRIBER_JWT_KEY: '${MERCURE_JWT_SECRET}'
    MERCURE_EXTRA_DIRECTIVES: |
      anonymous
      cors_origins *
      subscriptions
  ports:
    - "3100:3000"
```

- Draait op **port 3100** naast het platform (3456)
- JWT secret gedeeld tussen platform en hub
- Anonymous subscribers aan voor development (uit in productie)
- Subscriptions API aan voor monitoring

### 2. HITLaaS API (Next.js) — Publisher

Het platform publiceert naar Mercure bij elke state change:

```typescript
// src/lib/mercure.ts
import jwt from 'jsonwebtoken';

const MERCURE_HUB_URL = process.env.MERCURE_HUB_URL || 'http://mercure:3000/.well-known/mercure';
const MERCURE_JWT_SECRET = process.env.MERCURE_JWT_SECRET!;

export async function publishToMercure(topic: string, data: object, isPrivate = true) {
  const token = jwt.sign(
    { mercure: { publish: [topic] } },
    MERCURE_JWT_SECRET
  );

  await fetch(MERCURE_HUB_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      topic,
      data: JSON.stringify(data),
      private: isPrivate ? 'on' : '',
    }),
  });
}
```

### 3. Topics Structuur

```
/hitlaas/providers/{providerId}          ← Provider luistert hier (alle requests)
/hitlaas/requests/{requestId}            ← Consumer luistert hier (één conversatie)
```

**Provider topic:** ontvangt `new_request`, `status_change`, `new_message` voor alle clients
**Request topic:** ontvangt `keys_exchanged`, `new_message`, `closed` voor één conversatie

### 4. E2E Encryptie — Olm-inspired, Simpel

Geïnspireerd door Olm maar drastisch vereenvoudigd:

```
Elke partij genereert (eenmalig, in skill):
├── Ed25519 keypair    → signing + verificatie (identiteit)
├── X25519 keypair     → Diffie-Hellman key agreement (encryptie)
```

**Waarom X25519 i.p.v. RSA?**
- Olm/Signal gebruiken Curve25519/X25519 voor key exchange
- Kleiner (32 bytes vs 256 bytes voor RSA-2048)
- Sneller
- Diffie-Hellman: beide partijen berekenen **hetzelfde shared secret** zonder het te versturen
- Dit shared secret wordt de AES key → geen RSA-wrapped AES key meer nodig

### Key Exchange (Olm-inspired X3DH simplified)

```
Consumer                        Server                          Provider
────────                        ──────                          ────────
Ed25519 keypair (sign)
X25519 keypair (encrypt)

POST /help:
  consumerSignPub
  consumerX25519Pub             Store pubkeys
  encryptedPayload*             ────► Publish to provider topic
  signature                           "new_request" + consumer pubkeys

                                                                Ed25519 keypair (sign)  
                                                                X25519 keypair (encrypt)
                                                                
                                                                // Diffie-Hellman:
                                                                sharedSecret = X25519(
                                                                  providerPriv, consumerPub)
                                POST /key-exchange ◄────────────
                                  providerSignPub
                                  providerX25519Pub
                                
                                Publish to request topic
                                  "keys_exchanged" + provider pubkeys

// Diffie-Hellman:
sharedSecret = X25519(
  consumerPriv, providerPub)

// Beide hebben nu HETZELFDE sharedSecret
// zonder het ooit te versturen!

* Eerste bericht: encrypted met tijdelijke AES key,
  RSA-OAEP wrapped (provider heeft nog geen X25519 pub).
  OF: eerste bericht gaat plaintext metadata-only,
  echte content pas na key exchange.
```

### Message Encrypt/Decrypt (na key exchange)

```
Verzenden:
1. sharedSecret = X25519(eigen_priv, ontvanger_pub)  // DH
2. messageKey = HKDF(sharedSecret, salt=messageId)    // Per-message key
3. ciphertext = AES-256-GCM(plaintext, messageKey, iv)
4. signature = Ed25519_sign(ciphertext, eigen_sign_priv)
5. Send: { ciphertext, iv, signature, messageId }

Ontvangen:
1. Ed25519_verify(ciphertext, signature, afzender_sign_pub)  // Verify first!
2. sharedSecret = X25519(eigen_priv, afzender_pub)    // Same DH
3. messageKey = HKDF(sharedSecret, salt=messageId)    // Same key
4. plaintext = AES-256-GCM_decrypt(ciphertext, messageKey, iv)
```

**Voordelen t.o.v. v3 (RSA):**
- Geen RSA-wrapped AES keys meer in elk bericht (kleiner, sneller)
- Shared secret berekend via DH — nooit over de draad
- Per-message keys via HKDF (HMAC-based Key Derivation) met messageId als salt
- Dichter bij hoe Signal/Olm het doen

### 5. Dashboard Integratie

Het dashboard (Next.js frontend) gebruikt **native EventSource** om via Mercure te subscriben:

```typescript
// In dashboard React component
useEffect(() => {
  const url = new URL(MERCURE_HUB_URL);
  url.searchParams.append('topic', `/hitlaas/providers/${providerId}`);
  
  const es = new EventSource(url, { withCredentials: true });
  
  es.addEventListener('new_request', (e) => {
    const data = JSON.parse(e.data);
    // Server decrypts for dashboard view (server has access to stored messages)
    // Show notification + add to request list
    addNotification(`New request: ${data.refCode}`);
    refetchRequests();
  });

  es.addEventListener('new_message', (e) => {
    const data = JSON.parse(e.data);
    // Refresh message thread
    refetchMessages(data.requestId);
  });

  return () => es.close();
}, [providerId]);
```

**Dashboard ziet berichten via de server:**
- De server slaat berichten op (encrypted met DH shared secret)
- Voor het dashboard: server berekent het shared secret (hij heeft de provider's private key NIET)
- **Oplossing:** Provider dashboard gebruikt een **session key** die de provider's browser genereert
- OF: berichten worden voor het dashboard apart encrypted met een server-side key

**Simpelste aanpak voor dashboard:**
```
Consumer → encrypted(msg, DH_shared_secret) → Server
Server slaat op: encrypted blob
Provider skill → decrypt met DH → plaintext

Dashboard view:
- Provider logt in via OAuth
- Browser genereert tijdelijke RSA keypair
- Server re-encrypts berichten met browser's pubkey
- Browser decrypt lokaal
```

Maar dit is complex. **Pragmatische v1:**
- Dashboard berichten worden **server-side decrypted** voor de ingelogde provider
- Server bewaart een kopie van de provider's X25519 private key (opt-in, alleen voor dashboard)
- Skills werken volledig E2E (server ziet niets)
- Dashboard is een "trusted device" van de provider

### 6. Skill: `scripts/crypto.mjs` (updated)

```javascript
#!/usr/bin/env node
import crypto from 'crypto';
import fs from 'fs';

const [,, action, ...args] = process.argv;

// === KEYGEN ===
if (action === 'keygen') {
  const dir = args[0] || `${process.env.HOME}/.hitlaas`;
  fs.mkdirSync(dir, { recursive: true });
  
  // Ed25519 (signing)
  const ed = crypto.generateKeyPairSync('ed25519', {
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
  });
  fs.writeFileSync(`${dir}/sign_public.pem`, ed.publicKey);
  fs.writeFileSync(`${dir}/sign_private.pem`, ed.privateKey);
  
  // X25519 (encryption via DH)
  const x = crypto.generateKeyPairSync('x25519', {
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
  });
  fs.writeFileSync(`${dir}/encrypt_public.pem`, x.publicKey);
  fs.writeFileSync(`${dir}/encrypt_private.pem`, x.privateKey);
  
  console.log(JSON.stringify({
    signPublicKey: ed.publicKey,
    encryptPublicKey: x.publicKey
  }));
}

// === ENCRYPT ===
if (action === 'encrypt') {
  const [plaintext, recipientX25519PubPath, ownSignPrivPath, messageId] = args;
  const recipientPub = crypto.createPublicKey(fs.readFileSync(recipientX25519PubPath));
  const ownEncPriv = crypto.createPrivateKey(fs.readFileSync(
    ownSignPrivPath.replace('sign_private', 'encrypt_private')));
  const signPriv = fs.readFileSync(ownSignPrivPath);
  
  // Diffie-Hellman shared secret
  const sharedSecret = crypto.diffieHellman({
    privateKey: ownEncPriv,
    publicKey: recipientPub
  });
  
  // HKDF: derive per-message key
  const messageKey = crypto.hkdfSync('sha256', sharedSecret, messageId || '', 'hitlaas-msg', 32);
  
  // AES-256-GCM encrypt
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', Buffer.from(messageKey), iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  
  // Ed25519 sign the ciphertext (sign what you send)
  const signature = crypto.sign(null, encrypted, signPriv);
  
  console.log(JSON.stringify({
    ciphertext: encrypted.toString('base64'),
    iv: iv.toString('base64'),
    authTag: authTag.toString('base64'),
    signature: signature.toString('base64'),
    messageId: messageId || crypto.randomUUID()
  }));
}

// === DECRYPT ===
if (action === 'decrypt') {
  const [payloadJson, senderX25519PubPath, senderSignPubPath, ownEncPrivPath] = args;
  const payload = JSON.parse(payloadJson);
  const senderPub = crypto.createPublicKey(fs.readFileSync(senderX25519PubPath));
  const senderSignPub = fs.readFileSync(senderSignPubPath);
  const ownPriv = crypto.createPrivateKey(fs.readFileSync(ownEncPrivPath));
  
  // Verify signature first
  const ciphertext = Buffer.from(payload.ciphertext, 'base64');
  const valid = crypto.verify(null, ciphertext, senderSignPub, 
    Buffer.from(payload.signature, 'base64'));
  
  if (!valid) {
    console.error('❌ SIGNATURE VERIFICATION FAILED');
    process.exit(1);
  }
  
  // Diffie-Hellman shared secret
  const sharedSecret = crypto.diffieHellman({ privateKey: ownPriv, publicKey: senderPub });
  
  // HKDF derive same key
  const messageKey = crypto.hkdfSync('sha256', sharedSecret, payload.messageId, 'hitlaas-msg', 32);
  
  // AES-256-GCM decrypt
  const decipher = crypto.createDecipheriv('aes-256-gcm', 
    Buffer.from(messageKey), Buffer.from(payload.iv, 'base64'));
  decipher.setAuthTag(Buffer.from(payload.authTag, 'base64'));
  const plaintext = Buffer.concat([
    decipher.update(ciphertext), decipher.final()
  ]).toString('utf8');
  
  console.log(plaintext);
}
```

## Endpoints (Updated)

| Endpoint | Methode | Rol | Beschrijving |
|----------|---------|-----|-------------|
| `/api/v1/help` | POST | Consumer | Start conversatie + eerste bericht |
| `/api/v1/key-exchange/{requestId}` | POST | Provider | Stuurt provider pubkeys |
| `/api/v1/message/{requestId}` | POST | Beide | Encrypted + signed bericht |
| `/api/v1/messages/{requestId}` | GET | Beide | Berichtgeschiedenis |
| `/api/v1/close/{requestId}` | POST | Beide | Sluit conversatie |
| **Mercure Hub** | | | |
| `/.well-known/mercure` | GET | Beide | SSE subscribe (via Mercure) |
| `/.well-known/mercure` | POST | Server | Publish events (intern) |

**Geen eigen SSE endpoints meer!** Alles gaat via Mercure.

## Database Schema

```prisma
model HelpRequest {
  id                     String    @id @default(cuid())
  refCode                String    @unique
  apiKeyId               String
  apiKey                 ApiKey    @relation(fields: [apiKeyId], references: [id])
  expertId               String
  
  // Consumer keys
  consumerSignPubKey     String
  consumerEncryptPubKey  String    // X25519
  
  // Provider keys (na key exchange)
  providerSignPubKey     String?
  providerEncryptPubKey  String?   // X25519
  
  status      String    @default("pending") // pending|active|closed|expired
  expiresAt   DateTime                      // createdAt + 72h
  closedAt    DateTime?
  
  messages    Message[]
  createdAt   DateTime  @default(now())
}

model Message {
  id          String      @id @default(cuid())
  requestId   String
  request     HelpRequest @relation(fields: [requestId], references: [id])
  from        String      // "consumer" | "provider"
  ciphertext  String      // AES-256-GCM encrypted (base64)
  iv          String      // (base64)
  authTag     String      // (base64)
  signature   String      // Ed25519 (base64)
  messageId   String      @unique // Voor HKDF salt + dedup
  createdAt   DateTime    @default(now())
}
```

## Conversatie Flow

```
                    CONSUMER (Patrick)                    SERVER + MERCURE                    PROVIDER (Octo)
                    ──────────────────                    ────────────────                    ───────────────
                    
Setup (eenmalig):   node crypto.mjs keygen                                                  node crypto.mjs keygen
                    ~/.hitlaas/sign_{pub,priv}.pem                                          ~/.hitlaas/sign_{pub,priv}.pem
                    ~/.hitlaas/encrypt_{pub,priv}.pem                                       ~/.hitlaas/encrypt_{pub,priv}.pem

                                                         Provider subscribet op Mercure:
                                                         topic=/hitlaas/providers/{id}
                                                         (persistent, herstart elk uur)

1. Vraag stellen:   POST /api/v1/help
                    { apiKey, signPub, encryptPub,
                      metadata: "stuck on X" }
                    (eerste bericht onencrypted OF
                     encrypted met server pubkey)
                                                         Store request + pubkeys
                                                         Publish → provider topic:
                                                         { type: "new_request",
                                                           refCode, requestId,
                                                           consumerPubKeys }

                    Subscribe op Mercure:                                                    SSE: "new_request" ✨
                    topic=/hitlaas/requests/{id}                                             
                                                                                            Stuur Thomas notificatie 📱
                                                                                            
                                                                                            POST /key-exchange
                                                                                            { signPub, encryptPub }
                                                         Store provider pubkeys
                                                         Publish → request topic:
                                                         "keys_exchanged"

                    SSE: "keys_exchanged" ✨
                    Bewaar provider pubkeys
                    
                    Nu: DH shared secret berekend
                    (beide kanten onafhankelijk)
                    
2. Conversatie:                                                                             node crypto.mjs encrypt
                                                                                            "Probeer Y als oplossing"
                                                                                            POST /api/v1/message/{id}
                                                         Store encrypted message
                                                         Publish → request topic
                    SSE: "new_message" ✨
                    node crypto.mjs decrypt
                    → "Probeer Y als oplossing"
                    
                    Vervolg vraag:
                    node crypto.mjs encrypt
                    "Dat werkt niet want Z"
                    POST /api/v1/message/{id}
                                                         Store + Publish → provider topic
                                                                                            SSE: "new_message" ✨
                                                                                            decrypt → lees vraag
                                                                                            antwoord → encrypt → POST
                    
                    ... conversatie gaat door ...

3. Sluiten:         POST /api/v1/close/{id}
                    OF: automatisch na 72u
                                                         Publish "closed" op beide topics
                    SSE: "closed"                                                           SSE: "request_closed"
                    EventSource.close()                                                     (blijft luisteren voor
                                                                                             andere requests)
```

## Keep-Alive & Reconnect

| Aspect | Oplossing |
|--------|----------|
| Server → Client | Mercure's ingebouwde heartbeat (40s, configureerbaar) |
| Missed events | Mercure's `Last-Event-ID` — bij reconnect krijg je gemiste events |
| Provider disconnect | Skill cron: elk uur check of EventSource leeft, herstart zo nodig |
| Consumer disconnect | EventSource auto-reconnect (browser native) |
| Hub crash | Docker `restart: unless-stopped` + BoltDB persistence |

## Dashboard Integratie

### Realtime updates in React
```typescript
// hooks/useMercure.ts
export function useMercure(topic: string, onEvent: (data: any) => void) {
  useEffect(() => {
    const url = new URL(`${MERCURE_HUB_URL}/.well-known/mercure`);
    url.searchParams.append('topic', topic);
    
    const jwt = getSubscriberJWT(); // JWT met subscribe rechten
    const es = new EventSourcePolyfill(url.toString(), {
      headers: { 'Authorization': `Bearer ${jwt}` }
    });
    
    es.onmessage = (e) => onEvent(JSON.parse(e.data));
    return () => es.close();
  }, [topic]);
}

// In DashboardPage:
useMercure(`/hitlaas/providers/${user.id}`, (event) => {
  if (event.type === 'new_request') toast.info(`New: ${event.refCode}`);
  if (event.type === 'new_message') refetchThread(event.requestId);
});
```

### Dashboard berichten lezen
**Pragmatische v1:** Server decryptyt berichten voor de ingelogde provider via een dashboard-only endpoint. De provider is geauthenticeerd via OAuth, de server fungeert als "trusted proxy" voor dashboard view. Skills blijven volledig E2E.

```
GET /api/v1/messages/{requestId}?decrypt=true
Authorization: Bearer <session-token>

→ Server berekent DH shared secret (heeft provider keys in DB)
→ Decryptyt berichten
→ Stuurt plaintext naar geauthenticeerde provider browser
```

**Toekomstige v2:** Browser-side decryptie (provider's browser genereert eigen keypair, server stuurt encrypted blobs).

## Vergelijking v3 vs v4

| Aspect | v3 (Custom SSE) | v4 (Mercure + Olm-inspired) |
|--------|-----------------|---------------------------|
| SSE Hub | Zelfgebouwd (EventEmitter) | **Mercure** (bewezen, Go, 10K+ GitHub stars) |
| Reconnect | Zelf bouwen | **Gratis** (Mercure + EventSource) |
| Missed events | Zelf bouwen | **Gratis** (Last-Event-ID + BoltDB) |
| Keep-alive | Zelf bouwen (30s ping) | **Gratis** (Mercure heartbeat) |
| Key exchange | RSA pubkey uitwisseling | **X25519 Diffie-Hellman** (Olm-inspired) |
| Encryptie | RSA-OAEP + AES-GCM | **X25519 DH + HKDF + AES-GCM** |
| Signatures | Ed25519 | Ed25519 (zelfde) |
| Per-message keys | Nee (zelfde AES key) | **Ja** (HKDF met messageId) |
| Dashboard | Eigen SSE endpoint | **Mercure EventSource** (native browser) |
| Deployment | Alleen Next.js | Next.js + Mercure Docker |
| Lines of code | ~500 (SSE + bus + ping) | ~100 (publish helper) |

## Implementatie Volgorde

### Fase 1: Mercure Setup (30 min)
1. Mercure toevoegen aan `docker-compose.yml`
2. `src/lib/mercure.ts` — publish helper
3. JWT secret configureren
4. Test: publish + subscribe via curl

### Fase 2: API Refactor (2 uur)
5. Verwijder `src/lib/event-bus.ts` (vervangen door Mercure)
6. Verwijder `src/app/api/v1/events/route.ts` (vervangen door Mercure)
7. Update `POST /api/v1/help` — publish naar Mercure
8. Nieuw: `POST /api/v1/key-exchange/{requestId}`
9. Nieuw: `POST /api/v1/message/{requestId}`
10. Nieuw: `GET /api/v1/messages/{requestId}`
11. Nieuw: `POST /api/v1/close/{requestId}`
12. Database migratie: Message model + HelpRequest keys

### Fase 3: Crypto Script (1 uur)
13. `scripts/crypto.mjs` — keygen, encrypt, decrypt met X25519 + Ed25519
14. Unit tests voor crypto roundtrip

### Fase 4: Skills Update (1 uur)
15. Consumer skill — keygen + subscribe + encrypt/decrypt
16. Provider skill — persistent subscribe + key-exchange + respond
17. Keep-alive cron voor provider skill

### Fase 5: Dashboard (1 uur)
18. `useMercure` hook voor realtime updates
19. Request list auto-update bij new_request
20. Message thread auto-update bij new_message
21. Decrypted message view voor provider

### Fase 6: Tests & Polish (30 min)
22. E2E test: consumer → key exchange → messages → close
23. Reconnect test: kill Mercure → restart → verify no lost messages
24. TTL test: verify 72h expiry

**Totale geschatte tijd: ~6 uur**

---

## Samenvatting

**Mercure** vervangt al onze custom SSE code (event bus, ping, reconnect, history) met een bewezen open-source hub. **Olm-inspired crypto** (X25519 DH + Ed25519 signing + HKDF per-message keys) geeft ons Signal-niveau encryptie zonder de complexiteit van het volledige Olm protocol. Het dashboard werkt via Mercure's native EventSource support — realtime updates zonder custom SSE endpoints.
