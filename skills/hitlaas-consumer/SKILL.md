```skill
# HITLaaS Consumer Skill

## What is HITLaaS?
Human-In-The-Loop as a Service. When you (an AI agent) get stuck, you request help from a human expert via the relay. The response is delivered to your callback webhook — no polling needed.

## Configuration

| Variable | Description |
|---|---|
| `HITLAAS_API_KEY` | Your API key (`htl_...`) — passed as `x-api-key` header |
| `HITLAAS_CALLBACK_URL` | Your webhook endpoint for receiving responses |
| `HITLAAS_RELAY_URL` | Relay base URL (default: `http://localhost:4000`) |

## Security

All communication is **E2E encrypted**:
- You generate an RSA key pair locally
- Send your **public key** with the request
- The response comes back encrypted with your public key
- Only you can decrypt it with your private key
- The relay never sees plaintext message content

## How It Works

### 1. Generate Key Pair (once)

```bash
openssl genpkey -algorithm RSA -out hitlaas-private.pem -pkeyopt rsa_keygen_bits:2048
openssl rsa -in hitlaas-private.pem -pubout -out hitlaas-public.pem
```

### 2. Request Help

**POST** `/api/v1/relay/send`

Headers: `x-api-key: htl_your_key_here` and `Content-Type: application/json`

**Body:**
```json
{
  "callbackUrl": "https://your-server.com/hitlaas/callback",
  "consumerPublicKey": "-----BEGIN PUBLIC KEY-----...",
  "messages": [
    { "role": "user", "content": "Deploy the app" },
    { "role": "assistant", "content": "Got error X, tried Y and Z" }
  ],
  "question": "How do I fix deployment error X?"
}
```

**Required:** `callbackUrl`, `messages`
**Optional:** `consumerPublicKey` (PEM — if set the response is E2E encrypted for you), `question`

**Response:**
```json
{
  "requestId": "abc123",
  "refCode": "HTL-AB12",
  "status": "pending",
  "serverPublicKey": "-----BEGIN PUBLIC KEY-----...",
  "expiresAt": "2026-02-20T10:30:00.000Z"
}
```

### 3. Receive Response via Webhook

The relay POSTs to your `callbackUrl` when the expert responds:

```json
{
  "event": "response_ready",
  "requestId": "abc123",
  "refCode": "HTL-AB12",
  "encryptedResponse": "<encrypted-with-your-public-key>",
  "respondedAt": "2026-02-20T10:15:00.000Z"
}
```

### 4. Decrypt Response

Format: `rsaEncryptedAesKey.iv.authTag.aesCiphertext` (base64 segments).
Decrypt the AES key with your private key (RSA-OAEP), then AES-256-GCM decrypt.

### 5. Check Status (no auth required)

**GET** `/api/v1/relay/status/{requestId}`

## Helper Scripts

```bash
export HITLAAS_API_KEY=htl_xxx
export HITLAAS_CALLBACK_URL=https://your-server.com/hitlaas/callback
export HITLAAS_RELAY_URL=http://localhost:4000

./scripts/request-help.sh "How do I fix error X?" messages.json
./scripts/check-status.sh <requestId>
```
```
