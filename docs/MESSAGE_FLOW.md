# Message Flow Architecture

This document explains how a message travels through HeySummon — from API submission, through validation, storage, and polling-based delivery.

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
│   4. POLLING - Event Discovery                              │
│   • Provider polls GET /api/v1/events/pending               │
│   • Dashboard polls for updates                             │
│   • Consumer polls GET /api/v1/help/:id                     │
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
        │    │ Channel Adapters:         │
        │    │ • Telegram                │
        │    │ • WhatsApp                │
        │    │ • SMS/Email (future)      │
        │    │ Sends ref code + message  │
        │    └───────┬───────────────────┘
        │            │
        │            ▼
        │    ┌───────────────────────────┐
        │    │ 6. ACKNOWLEDGMENT (ACK)   │
        │    │ GET /api/v1/events/ack/:id│
        │    │ Provider confirms receipt │
        │    └───────┬───────────────────┘
        │            │
        │            ▼
        │    ┌───────────────────────────┐
        │    │ Update deliveredAt        │
        │    │ Log audit event           │
        │    │ DB: HelpRequest.deliveredAt│
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

### 4️⃣ Polling: Event Discovery

**File**: `/src/app/api/v1/events/pending/route.ts`

After successful storage, interested parties discover new events by polling.

#### Provider Watcher Polling

The provider watcher polls `GET /api/v1/events/pending` on an interval to discover new requests:

```bash
# polling-watcher.sh polls every few seconds
curl -H "x-api-key: hs_prov_secret123" \
  "http://localhost:3456/api/v1/events/pending"
```

Response:
```json
{
  "events": [
    {
      "type": "new_request",
      "requestId": "req-789",
      "refCode": "HS-XYZ9",
      "question": "How do I...?",
      "status": "pending",
      "createdAt": "2026-02-28T09:00:00Z"
    }
  ]
}
```

#### Dashboard Polling

The dashboard periodically fetches updated request data to reflect changes in the UI.

---

### 5️⃣ Provider Delivery: Notifications & Channel Adapters

**File**: `/src/lib/channels/`, `/src/app/api/adapters/telegram/[id]/webhook/route.ts`

When the provider watcher discovers a new event via polling, it processes the event and delivers a notification.

#### Provider Watcher (CLI/OpenClaw Skill)

The provider runs a **watcher script** (via OpenClaw integration) that:

1. **Polls for pending events**:
   ```bash
   # ~/clawd/skills/heysummon-provider/scripts/polling-watcher.sh
   curl -H "x-api-key: hs_prov_secret123" \
     "http://localhost:3456/api/v1/events/pending"
   ```

2. **Processes each event**:
   ```bash
   refCode="HS-ABC1"

   # Format notification using channel adapter
   NOTIFICATION="New request $refCode: How do I...?"

   # Send via Telegram/WhatsApp/etc
   SEND_TELEGRAM "$CHAT_ID" "$NOTIFICATION"
   ```

3. **Acknowledges delivery**:
   ```bash
   curl "http://localhost:3456/api/v1/events/ack/$REQUEST_ID" \
     -H "x-api-key: hs_prov_secret123"
   ```

---

### 6️⃣ Acknowledgment (ACK) Logic

**File**: `/src/app/api/v1/events/ack/[requestId]/route.ts`

The ACK mechanism proves that a provider has **received and processed** a notification.

#### How ACK Works

When the provider watcher successfully sends a notification to the channel (Telegram, WhatsApp, etc.), it calls:

```bash
POST /api/v1/events/ack/{requestId}
Authorization: x-api-key: hs_prov_secret123
```

**Request**:
```json
{}
```

**Response**:
```json
{
  "ok": true,
  "deliveredAt": "2026-02-28T10:30:45.000Z"
}
```

#### What Happens on the Backend

```typescript
// 1. Authenticate provider key
const provider = await prisma.userProfile.findFirst({
  where: { key: apiKey, isActive: true },
  select: { id: true, userId: true }
});

// 2. Verify request belongs to provider
const helpRequest = await prisma.helpRequest.findFirst({
  where: {
    id: requestId,
    expertId: provider.userId  // ← Only owner can ACK
  }
});

// 3. Set deliveredAt timestamp (idempotent)
if (!helpRequest.deliveredAt) {
  await prisma.helpRequest.update({
    where: { id: requestId },
    data: { deliveredAt: new Date() }
  });
}

// 4. Log audit event
logAuditEvent({
  eventType: 'NOTIFICATION_DELIVERED',
  userId: provider.userId,
  metadata: { requestId, refCode: helpRequest.refCode }
});
```

#### Why is ACK Important?

| Scenario | Without ACK | With ACK |
|----------|-----------|----------|
| Watcher crashes before delivery | Provider thinks they know | Platform tracks: not delivered |
| Telegram bot disconnects | Unknown if sent | Platform knows: ACK not received |
| Network timeout | Unknown status | Clear delivery proof |
| Resend logic | No way to know if stale | Platform can resend if no ACK |

#### Delivery Status on Dashboard

```typescript
// In request-detail.tsx
if (request.deliveredAt) {
  return <span className="bg-emerald-500 text-white">✓ Delivered</span>;
} else if (request.status === 'pending') {
  return <span className="bg-amber-500 text-white">⏳ Not delivered</span>;
}
```

Shows:
- **Before ACK**: "⏳ Not delivered"
- **After ACK**: "✓ Delivered" + timestamp

---

### 7️⃣ Channel Adapters: Multi-Platform Delivery

**File**: `/src/lib/channels/telegram.ts`, `/src/lib/channels/whatsapp.ts`

HeySummon uses **adapters** so providers can receive notifications on their preferred channel.

#### How Adapters Work

```typescript
interface ChannelAdapter {
  type: 'telegram' | 'whatsapp' | 'email';
  
  // Format request notification
  formatNotification(event: HelpRequestEvent): FormattedMessage;
  
  // Format provider reply
  formatReply(response: string, refCode: string): FormattedMessage;
  
  // Activate channel (validate bot token, set webhooks)
  onActivate?(channelId: string, config: ChannelConfig): Promise<void>;
  
  // Deactivate channel (cleanup webhooks, etc)
  onDeactivate?(channelId: string, config: ChannelConfig): Promise<void>;
  
  // Send actual message
  sendMessage?(chatId: string, text: string, config: ChannelConfig): Promise<void>;
}
```

#### Example: Telegram Adapter

**Notification format**:
```
📨 New request HS-ABC1
Question: How do I reset my password?

👤 John
⏱️ 3 minutes ago
```

**Reply format**:
```
📝 Reply to HS-ABC1

Yes, you can reset it from settings.
```

**Webhook**:
- Telegram sends updates to `/api/adapters/telegram/{channelId}/webhook`
- Platform parses reply, extracts ref code
- Creates message via `/api/v1/message/{requestId}`

#### Example: WhatsApp Adapter

**Notification**:
```
New request HS-ABC1: How do I...?
```

**Reply parsing**:
- Extracts ref code from message
- Sends as consumer message
- WhatsApp 24-hour window enforced at delivery layer

---

### 8️⃣ Pending Events Recovery

**File**: `/src/app/api/v1/events/pending/route.ts`

If the watcher crashes or misses events, it catches up automatically on the next poll cycle.

```bash
GET /api/v1/events/pending
x-api-key: hs_prov_abc123
```

**Returns** (up to 50 undelivered requests):

```json
{
  "events": [
    {
      "type": "new_request",
      "requestId": "req-789",
      "refCode": "HS-XYZ9",
      "question": "How do I...?",
      "status": "pending",
      "createdAt": "2026-02-28T09:00:00Z",
      "expiresAt": "2026-03-03T09:00:00Z"
    }
  ]
}
```

**Watcher logic**:
1. Poll `GET /api/v1/events/pending` on interval
2. Process each pending event
3. Send notification via channel adapter
4. Acknowledge each with `GET /api/v1/events/ack/:id`

This ensures **no messages are lost** even if the watcher crashes!

---

### 9️⃣ Frontend: Updates via Polling

**File**: `/src/components/dashboard/request-detail.tsx`

The dashboard polls for updates to reflect new messages and status changes in the UI.

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
        ║  4. POLLING DISCOVERY    ║
        ║                          ║
        ║ Provider watcher polls:  ║
        ║  GET /events/pending     ║
        ║                          ║
        ║ Dashboard polls for      ║
        ║ updated request data     ║
        ║                          ║
        ║ Consumer polls:          ║
        ║  GET /api/v1/help/:id    ║
        ╚══════════════════════════╝
```

---

## Complete Data Flow Diagram

**Polling Architecture**: Clients discover events by polling the platform API.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         CONSUMER FLOW (sending help)                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Consumer App                                                              │
│     │                                                                      │
│     │ 1. POST /help via Guard proxy                                        │
│     │    (with PII/XSS/URL validation)                                     │
│     ├──────────────────────────>  Guard Proxy :8081                        │
│     │                             (content-safety module)                  │
│     │                                  │                                   │
│     │                                  │ 2. Forward to platform API        │
│     │                                  │    validate consumer signature    │
│     │                                  ├──────────────>  /api/help         │
│     │                                  │                (main app)         │
│     │                                  │                │                  │
│     │                                  │                │ 3. Create Request │
│     │                                  │                │ 4. Store in DB   │
│     │                                  │                │                  │
│     │                                  │<──── signed    │                  │
│     │                                  │ receipt        │                  │
│     │<────────────────────────────────────────────────  │                  │
│     │                                                    │                  │
└──────────────────────────────────────────────────────────┼──────────────────┘
                                                            │
┌────────────────────────────────────────────────────────────────────────────────┐
│        EVENT DISCOVERY (via HTTP polling)                                      │
├────────────────────────────────────────────────────────────────────────────────┤
│                                                                                │
│  Provider Watcher                    Dashboard (Browser)                      │
│  (OpenClaw Skill)                                                             │
│      │                                  │                                     │
│      │ 5a. GET /api/v1/events/          │ 5b. Polls for updated              │
│      │     pending                      │     request data                    │
│      │     (x-api-key)                  │     (session cookie)                │
│      │                                  │                                     │
│      │ 6. Process pending events        │ 6. Dashboard refreshes             │
│      │    (send notifications)          │    with latest data                │
│      │                                  │                                     │
│      │ 7. Channel adapter formats       │                                     │
│      │    notification                  │                                     │
│      │    (Telegram/WhatsApp/etc)       │                                     │
│      │                                  │                                     │
│      │ 8. Acknowledge delivery          │                                     │
│      │    GET /api/v1/events/ack/:id    │                                     │
│                                                                                │
└────────────────────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────────────────────┐
│                    PROVIDER REPLY (closing the loop)                           │
├────────────────────────────────────────────────────────────────────────────────┤
│                                                                                │
│  Provider clicks "resolve" button OR replies via Telegram/WhatsApp            │
│                                                                                │
│  9. POST /api/v1/message/{requestId}                                          │
│      (with consumer public key, encrypted payload)                            │
│      ├──────────> /api/message (auth middleware)                              │
│      │            • Verify provider signature                                │
│      │            • Validate request exists                                  │
│      │            • Create Message record (encrypted)                        │
│      │                                                                        │
│      │ 10. Consumer polls GET /api/v1/help/:id                               │
│      │     • Discovers response                                              │
│      │     • Decrypts message with Ed25519 verification                      │
│      │                                                                        │
│  11. GET /api/v1/events/ack/{requestId}                                       │
│      (watcher confirms receipt)                                              │
│      ├──────────> /api/events/ack                                            │
│      │             • Sets deliveredAt timestamp                              │
│      │             • Logs audit event                                        │
│      │                                                                        │
│      │ 12. Dashboard polls and sees ack                                      │
│      │     • Updates UI: "Delivered to provider"                              │
│                                                                                │
└────────────────────────────────────────────────────────────────────────────────┘


Key Architecture Points:
  • Guard Proxy (port 8081): Validates content, creates signed receipt
  • Main App API: Handles all database operations
  • Polling endpoints: /api/v1/events/pending + /api/v1/events/ack/:id
  • Each client (watcher, dashboard, consumer) authenticates per request
  • All encryption/decryption happens client-side or at platform boundaries
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

### GET /api/v1/events/pending

**Poll for pending events**

```bash
curl http://localhost:3425/api/v1/events/pending \
  -H "x-api-key: hs_prov_secret"
```

### GET /api/v1/events/ack/:id

**Acknowledge event delivery**

```bash
curl http://localhost:3425/api/v1/events/ack/req-123 \
  -H "x-api-key: hs_prov_secret"
```

---

## Security Layers

**Defense in Depth**:

| Layer | Mechanism | Protects Against |
|-------|-----------|------------------|
| **Guard** | Content validation + Ed25519 signing | Malicious content, XSS, PII exposure |
| **API Key** | Unique per consumer/provider, time-limited | Unauthorized access, key reuse |
| **IP Binding** | Provider keys bound to specific IP | Theft of provider credentials |
| **Device Secret** | IP + device secret pair validation | Lateral movement from compromised IP |
| **Receipt** | Ed25519 signature + timestamp + nonce | Replay attacks, bypassing Guard |
| **Ownership** | Request belongs to provider/consumer | Cross-user access |
| **Encryption** | AES-256-GCM per message | Eavesdropping at rest |
| **Signature** | Ed25519 on ciphertext | Tampering with encrypted content |
| **Audit Log** | Log all API actions + ACK events | Post-breach investigation, delivery tracking |

**Key Security Principles:**
1. **All API requests are authenticated** — API key or session required
2. **Replay prevention** — timestamps + nonces make old requests invalid
3. **Audit trail** — every action (send, deliver, ack) is logged

---

## Troubleshooting

### Polling not returning events?

1. **Verify API key format**:
   - Provider watchers use: `hs_prov_*`
   - Consumer clients use: `hs_cli_*`
   - Check the key isn't rotated or revoked

2. **Check pending events endpoint**:
   ```bash
   curl -H "x-api-key: hs_prov_YOUR_KEY" \
     http://localhost:3456/api/v1/events/pending

   # Should return 200 with events array
   ```

3. **Check IP validation** (for provider keys):
   - IP must match the key's IP binding
   - Check in database: `SELECT ipBound FROM ApiKey WHERE ...`

4. **Restart everything**:
   ```bash
   pnpm run dev:all   # or
   docker compose restart
   ```

### Message stored but not decrypted?

- **Check shared secret**: Consumer and provider must use the same X25519 key exchange
- **Check IV/authTag**: Verify these are base64-encoded properly
- **Check signature**: Ed25519 signature must match the signing public key
- **Check proxy didn't modify**: Proxy passes messages through unchanged

### Guard blocking legitimate content?

- Check Guard logs: what flags were set?
- Verify REQUIRE_GUARD setting (can disable in dev)
- Review sanitized text: what was redacted?

### Watcher not receiving ACK'd events?

- Watcher must call `POST /api/v1/events/ack/{requestId}` after processing
- ACK must include proper signature
- Dashboard will see `deliveredAt` timestamp after ACK
- Check audit log: `SELECT * FROM AuditLog WHERE action = 'ack'`

### Events not being acknowledged?

- Ensure you call `GET /api/v1/events/ack/:id` after processing each event
- The request ID in the ack URL must match a request owned by the authenticated provider
- Check audit log: `SELECT * FROM AuditLog WHERE action = 'ack'`

---

## Related Documentation

- [Encryption Model](./security/encryption-model.md) — How E2E encryption works
- [API Overview](./api/overview.md) — All endpoints and auth
- [Security Guide](./guides/api-keys.md) — Managing API keys
- [Architecture](./self-hosting/architecture.md) — System design

