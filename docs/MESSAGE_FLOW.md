# Message Flow Architecture

This document explains how a message travels through HeySummon — from API submission, through validation, storage, and real-time delivery.

## Overview: The Journey of a Message

```
┌─────────────────────────────────────────────────────────────┐
│              Consumer/Provider sends message                │
│              (via SDK or direct API call)                   │
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
│   • Stores: ciphertext, IV, authTag, signature             │
│   • Checks for duplicates using messageId                   │
│   • Creates audit log entry                                 │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────┐
│   4. REAL-TIME UPDATES - Mercure/SSE Broadcast             │
│   • Publishes to /heysummon/requests/{requestId}            │
│   • Publishes to /heysummon/providers/{expertId}            │
│   • Dashboard subscribes via EventSource                    │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────┐
│   5. USER INTERFACE - Live Update                           │
│   • Dashboard sees new message in real-time                 │
│   • No polling needed                                       │
│   • Message history fetched with GET /api/v1/messages/:id  │
└─────────────────────────────────────────────────────────────┘
```

---

## Step-by-Step Breakdown

### 1️⃣ Guard Proxy: Content Validation

**File**: `/guard/src/index.ts`, `/guard/src/content-safety.ts`

The Guard is a **reverse proxy** that validates all incoming messages before they reach the Platform.

#### What Guard Does:

```typescript
// Pseudo-code flow
const request = await receiveHttpRequest();
const content = request.body.question || request.body.message;

// Step 1: Sanitize HTML/XSS
const { text: sanitized, flags: xssFlags } = sanitizeHtml(content);

// Step 2: Defang URLs (https → hxxps)
const { text: defanged, flags: urlFlags } = defangUrls(sanitized);

// Step 3: Detect & redact PII
const { text: safe, flags: piiFlags } = detectPii(defanged);

// Step 4: Create signed Ed25519 receipt
const receipt = createReceipt(safe);

// Step 5: Proxy to Platform with receipt header
request.headers['x-guard-receipt'] = receipt.token;
request.headers['x-guard-receipt-sig'] = receipt.signature;
proxyToBackend(request);
```

#### Example: PII Detection

If someone sends a message containing a credit card:

```
Input:  "Please charge my card: 4532-1488-0343-6467"
Output: "Please charge my card: [REDACTED CC]"
Flags:  { type: "credit_card", original: "4532-1488-0343-6467" }
```

Detected patterns:
- **Credit cards** (13-19 digits, Luhn validated)
- **Email addresses** (user@domain.com)
- **Phone numbers** (various formats: +1 (555) 123-4567, etc.)
- **SSN/BSN** (US: XXX-XX-XXXX, NL: 9 digits)
- **URLs** (defanged: `https://example.com` → `hxxps://example[.]com`)
- **XSS/HTML** (stripped via DOMPurify)

**Blocking Rules**:
- ❌ Block if **credit card** detected
- ❌ Block if **SSN/BSN** detected
- ✅ Sanitize & allow: XSS, URLs, emails, phone (these are redacted)

---

### 2️⃣ Platform API: Authentication & Authorization

**File**: `/src/app/api/v1/message/[requestId]/route.ts`

When the request arrives at the Platform, multiple checks happen:

#### Authentication (Who are you?)

```typescript
const apiKey = request.headers.get("x-api-key");
if (!apiKey) return 401; // Missing API key

// Look up the key in the database
const apiKeyRecord = await prisma.apiKey.findUnique({
  where: { key: apiKey }
});
if (!apiKeyRecord) return 401; // Invalid key
```

**API Key Types**:
- `hs_prov_*` — Provider key (human experts)
- `hs_cli_*` — Consumer key (AI agents)

#### Authorization (Do you have permission?)

```typescript
// Extract the role from the API key
const callerRole = "provider" || "consumer";

// The message must match: from === callerRole
if (message.from !== callerRole) {
  return 403; // "Provider key can't send as consumer"
}

// For providers: verify they own this request
const ownRequest = await prisma.helpRequest.findFirst({
  where: { 
    id: requestId, 
    expertId: apiKey.userId  // Only the assigned expert can respond
  }
});
if (!ownRequest) return 403; // Not your request
```

#### Guard Receipt Verification

```typescript
const receiptB64 = request.headers.get("x-guard-receipt");
const signatureB64 = request.headers.get("x-guard-receipt-sig");

if (process.env.REQUIRE_GUARD === "true") {
  if (!receiptB64 || !signatureB64) return 403;
  
  // Verify Ed25519 signature
  const receipt = verifyGuardReceipt(receiptB64, signatureB64);
  if (!receipt) return 403; // Invalid/replayed
  
  // Check receipt freshness (< 5 minutes old)
  const age = Date.now() - receipt.timestamp;
  if (age > 5 * 60 * 1000) return 403;
  
  // Check nonce uniqueness (prevent replay attacks)
  if (usedNonces.has(receipt.nonce)) return 403;
  usedNonces.set(receipt.nonce, Date.now() + 5 * 60 * 1000);
}
```

---

### 3️⃣ Database Storage: Message Model

**File**: `/prisma/schema.prisma`

Once verified, the message is stored in the `Message` table:

```prisma
model Message {
  id          String      @id @default(cuid())
  requestId   String      // Which HelpRequest does this belong to?
  from        String      // "consumer" or "provider"
  
  // E2E encrypted payload
  ciphertext  String      // AES-256-GCM encrypted (base64)
  iv          String      // Initialization vector
  authTag     String      // GCM authentication tag
  signature   String      // Ed25519 signature of ciphertext
  messageId   String      @unique // For deduplication
  
  createdAt   DateTime    @default(now())
  
  @@index([requestId])
  @@index([messageId])
}
```

#### Why These Fields?

| Field | Purpose |
|-------|---------|
| `ciphertext` | The actual encrypted message content |
| `iv` (Initialization Vector) | Random salt for encryption — different for each message |
| `authTag` | GCM authentication tag — prevents tampering |
| `signature` | Ed25519 signature of ciphertext — proves sender |
| `messageId` | Unique ID per message — prevents duplicate storage |

#### Encryption Example

```typescript
// Input: plaintext message
const plaintext = "Yes, I can help with that";

// Generate random IV
const iv = crypto.randomBytes(12);

// Encrypt with shared secret
const cipher = crypto.createCipheriv('aes-256-gcm', sharedSecret, iv);
cipher.write(plaintext);
cipher.end();

const ciphertext = cipher.update('utf8', 'hex') + cipher.final('hex');
const authTag = cipher.getAuthTag();

// Sign with Ed25519
const signature = sign.detached(Buffer.from(ciphertext), signingKey);

// Stored in DB
await prisma.message.create({
  data: {
    requestId,
    from: "provider",
    ciphertext,
    iv: iv.toString('base64'),
    authTag: authTag.toString('base64'),
    signature: signature.toString('base64'),
    messageId: generateUniqueId()
  }
});
```

#### Deduplication via messageId

If the same message is sent twice (network retry), we detect it:

```typescript
const existing = await prisma.message.findUnique({
  where: { messageId: "abc123" }
});

if (existing) {
  return {
    success: true,
    messageId: "abc123",
    duplicate: true  // ← Signals to client: message already stored
  };
}
```

---

### 4️⃣ Real-Time Updates: Mercure/SSE

**File**: `/src/lib/mercure.ts`, `/src/app/api/internal/events/stream/route.ts`

After successful storage, the Platform **broadcasts** the update so interested parties know immediately.

#### Publishing to Mercure

```typescript
// When a message is stored, publish to Mercure hub
await publishToMercure(
  `/heysummon/requests/${requestId}`,  // Topic 1: all parties to this request
  {
    type: 'new_message',
    requestId,
    messageId,
    from: "provider",
    createdAt: "2026-02-28T10:30:00Z"
  }
);

await publishToMercure(
  `/heysummon/providers/${expertId}`,  // Topic 2: provider-specific updates
  {
    type: 'new_message',
    requestId,
    refCode: "HS-ABC1",
    messageId,
    // ...
  }
);
```

#### Mercure Topics

Think of topics as **broadcast channels**:

```
/heysummon/requests/{requestId}
└─ All updates for a specific request (consumer + provider subscribed)
   • new_message
   • keys_exchanged
   • closed
   • status_change

/heysummon/providers/{providerId}
└─ All updates for a specific provider
   • new_request
   • new_message (from consumers on their requests)
   • status_change
```

---

### 5️⃣ Frontend: Live Updates

**File**: `/src/hooks/useMercure.ts`, `/src/components/dashboard/request-detail.tsx`

The dashboard **subscribes** to relevant topics and receives updates in real-time.

#### How Subscription Works

```typescript
// Dashboard uses useMercure hook
function RequestDetail({ id }: { id: string }) {
  // Subscribe to this request's topic
  useRequestMercure(id, (event) => {
    if (event.type === 'new_message') {
      // Refresh the messages UI
      fetchRequest();
    }
  });
  
  // ...
}

// Under the hood:
export function useMercure(topics: string[], onEvent) {
  useEffect(() => {
    // Connect to SSE stream
    const es = new EventSource(
      `/api/internal/events/stream?topic=${topics.join('&topic=')}`
    );
    
    es.onmessage = (event) => {
      const data = JSON.parse(event.data);
      onEvent(data);  // ← Call the callback
    };
    
    return () => es.close();
  }, [topics]);
}
```

#### The EventSource Flow

```
Browser                    Platform SSE Proxy          Mercure Hub
  │                              │                           │
  │─── GET /events/stream ──────>│                           │
  │    ?topic=/requests/abc123   │                           │
  │                              │                           │
  │                              │─ Subscribe to topic ─────>│
  │                              │                           │
  │<─ SSE Connection Open ───────│                           │
  │    (streaming response)       │                           │
  │                              │                           │
  │                              │<─ New message event ──────│
  │<─ event: message ────────────│                           │
  │    data: {...}               │                           │
  │                              │                           │
  │ (render update)              │                           │
  │                              │                           │
```

---

## Data Flow Diagram: Complete Example

Let's trace a complete message:

```
PROVIDER sends response via API:
┌────────────────────────────────────────────┐
│ Provider's computer:                       │
│ POST /api/v1/message/req-xyz               │
│ Headers:                                   │
│   x-api-key: hs_prov_secret123            │
│   Content-Type: application/json           │
│ Body:                                      │
│   {                                        │
│     "from": "provider",                   │
│     "plaintext": "I can help!"            │
│   }                                        │
└────────────────────────────────────────────┘
                    │
                    ▼
        ╔══════════════════════════╗
        ║  1. GUARD VALIDATION     ║
        ║  /guard:3445             ║
        ║                          ║
        ║ • Check content safety   ║
        ║ • No XSS/PII/etc         ║
        ║ • Create Ed25519 receipt ║
        ║ • Add headers:           ║
        ║   x-guard-receipt        ║
        ║   x-guard-receipt-sig    ║
        ╚══════════════════════════╝
                    │
                    ▼
        ╔══════════════════════════╗
        ║  2. PLATFORM AUTH        ║
        ║  POST /api/v1/message    ║
        ║                          ║
        ║ • Verify API key         ║
        ║ • Verify ownership       ║
        ║ • Verify Guard receipt   ║
        ║ • Parse message          ║
        ╚══════════════════════════╝
                    │
                    ▼
        ╔══════════════════════════╗
        ║  3. ENCRYPTION & STORAGE ║
        ║  SQLite/PostgreSQL       ║
        ║                          ║
        ║ INSERT INTO Message:     ║
        ║   requestId: req-xyz     ║
        ║   from: provider         ║
        ║   ciphertext: ...        ║
        ║   iv, authTag, sig, ...  ║
        ║   messageId: msg-001     ║
        ╚══════════════════════════╝
                    │
                    ▼
        ╔══════════════════════════╗
        ║  4. MERCURE BROADCAST    ║
        ║  :3426 (Mercure hub)     ║
        ║                          ║
        ║ Publish to topics:       ║
        ║  • /requests/req-xyz     ║
        ║  • /providers/prov-123   ║
        ║                          ║
        ║ Event payload:           ║
        ║  {                       ║
        ║    type: new_message,    ║
        ║    messageId: msg-001,   ║
        ║    from: provider,       ║
        ║    createdAt: ...        ║
        ║  }                       ║
        ╚══════════════════════════╝
                    │
                    ▼
        ╔══════════════════════════╗
        ║  5. SSE TO BROWSER       ║
        ║  EventSource update      ║
        ║                          ║
        ║ event: message           ║
        ║ data: {...}              ║
        ║                          ║
        ║ (JavaScript receives)    ║
        ║ → refreshes UI           ║
        ║ → shows new message      ║
        ╚══════════════════════════╝
```

---

## API Endpoint Reference

### POST /api/v1/message/:requestId

**Send a message**

```bash
curl -X POST http://localhost:3425/api/v1/message/req-123 \
  -H "x-api-key: hs_prov_secret" \
  -H "Content-Type: application/json" \
  -d '{
    "from": "provider",
    "plaintext": "Yes, I can help"
  }'
```

**Response**:
```json
{
  "success": true,
  "messageId": "msg-001",
  "createdAt": "2026-02-28T10:30:00.000Z"
}
```

### GET /api/v1/messages/:requestId

**Fetch message history** (encrypted blobs)

```bash
curl -X GET http://localhost:3425/api/v1/messages/req-123 \
  -H "x-api-key: hs_cli_consumer"
```

**Response**:
```json
{
  "requestId": "req-123",
  "messages": [
    {
      "id": "msg-001",
      "from": "provider",
      "ciphertext": "base64...",
      "iv": "base64...",
      "authTag": "base64...",
      "signature": "base64...",
      "messageId": "msg-001",
      "createdAt": "2026-02-28T10:30:00.000Z"
    }
  ]
}
```

### GET /api/internal/events/stream

**Subscribe to real-time updates** (SSE)

```javascript
const es = new EventSource(
  '/api/internal/events/stream?topic=/heysummon/requests/req-123'
);

es.onmessage = (event) => {
  const update = JSON.parse(event.data);
  console.log('Got update:', update);
  // { type: 'new_message', messageId: 'msg-001', from: 'provider' }
};
```

---

## Security Layers

**Defense in Depth**:

| Layer | Mechanism | Protects Against |
|-------|-----------|------------------|
| **Guard** | Content validation + Ed25519 signing | Malicious content, XSS, PII exposure |
| **API Key** | Unique per consumer/provider | Unauthorized access, key reuse |
| **Receipt** | Ed25519 signature + timestamp + nonce | Replay attacks, bypassing Guard |
| **Ownership** | Request belongs to provider/consumer | Cross-user access |
| **Encryption** | AES-256-GCM per message | Eavesdropping at rest |
| **Signature** | Ed25519 on ciphertext | Tampering with encrypted content |
| **Audit Log** | Log all API actions | Post-breach investigation |

---

## Troubleshooting

### Message not appearing in real-time?

1. **Check Mercure health**:
   ```bash
   curl http://localhost:3426/health
   ```

2. **Check SSE connection**:
   - Dashboard → Settings → check "Real-time Server" status
   - Browser DevTools → Network → look for `/api/internal/events/stream`
   - Should show `200` and streaming response

3. **Restart Mercure**:
   ```bash
   npm run dev:all   # or
   docker compose restart mercure
   ```

### Message stored but not decrypted?

- **Check shared secret**: Consumer and provider must use the same X25519 key exchange
- **Check IV/authTag**: Verify these are base64-encoded properly
- **Check signature**: Ed25519 signature must match the signing public key

### Guard blocking legitimate content?

- Check Guard logs: what flags were set?
- Verify REQUIRE_GUARD setting (can disable in dev)
- Review sanitized text: what was redacted?

---

## Related Documentation

- [Encryption Model](./security/encryption-model.md) — How E2E encryption works
- [API Overview](./api/overview.md) — All endpoints and auth
- [Security Guide](./guides/api-keys.md) — Managing API keys
- [Architecture](./self-hosting/architecture.md) — System design
