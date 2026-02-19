# HITLaaS Consumer Skill

## What is HITLaaS?
Human-In-The-Loop as a Service. When you (an AI agent) get stuck, you request help from a human expert. The response is delivered to your webhook — no polling needed.

## Configuration
- `HITLAAS_API_KEY` — your API key
- `HITLAAS_WEBHOOK_URL` — your webhook endpoint for receiving responses
- API Base URL: `https://provider.hitlaas.thomasansems.nl` (or self-hosted)

## Security
All communication is **E2E encrypted**:
- You generate an RSA key pair locally
- Send your **public key** with the request
- The response comes back encrypted with your public key
- Only you can decrypt it with your private key
- Webhook payloads are signed with HMAC-SHA256

## How It Works

### 1. Generate Key Pair (once)

```bash
# Generate RSA-2048 key pair
openssl genpkey -algorithm RSA -out hitlaas-private.pem -pkeyopt rsa_keygen_bits:2048
openssl rsa -in hitlaas-private.pem -pubout -out hitlaas-public.pem
```

### 2. Request Help

**POST** `/api/v1/help`

```json
{
  "apiKey": "<your-api-key>",
  "publicKey": "<your-RSA-public-key-PEM>",
  "webhookUrl": "https://your-server.com/hitlaas/callback",
  "messages": [
    { "role": "user", "content": "Deploy the app" },
    { "role": "assistant", "content": "Got error X, tried Y and Z" }
  ],
  "question": "How do I fix deployment error X?"
}
```

**Required fields:**
- `apiKey` — your API key
- `publicKey` — your RSA public key (PEM format)
- `webhookUrl` — where to deliver the response
- `messages` — array of conversation messages (last 10 kept)

**Optional:**
- `question` — specific question for the expert

**Response:**
```json
{
  "requestId": "clxyz...",
  "refCode": "HTL-AB12",
  "status": "pending",
  "webhookSecret": "abc123...",
  "serverPublicKey": "-----BEGIN PUBLIC KEY-----..."
}
```

**Store the `webhookSecret`** — use it to verify webhook signatures.

### 3. Receive Response via Webhook

When the expert responds, HITLaaS POSTs to your `webhookUrl`:

```
POST https://your-server.com/hitlaas/callback
Content-Type: application/json
X-HITLaaS-Event: response.delivered
X-HITLaaS-Request-Id: clxyz...
X-HITLaaS-Signature: sha256=<hmac-hex>
```

```json
{
  "requestId": "clxyz...",
  "refCode": "HTL-AB12",
  "status": "responded",
  "response": "<encrypted-with-your-public-key>",
  "respondedAt": "2026-02-19T21:00:00.000Z"
}
```

### 4. Verify & Decrypt

```bash
# Verify HMAC signature
echo -n '<raw-body>' | openssl dgst -sha256 -hmac '<webhookSecret>'

# Decrypt response (the response field is: rsaEncryptedAesKey.iv.authTag.aesCiphertext)
# Use your private key to decrypt the AES key, then AES-256-GCM to decrypt the message
```

### 5. Check Status (optional)

**GET** `/api/v1/help/{requestId}`

Returns status only (no response content — that's webhook-only):
```json
{
  "requestId": "clxyz...",
  "refCode": "HTL-AB12",
  "status": "responded",
  "webhookDelivered": true
}
```

## Webhook Retry Policy
- 3 attempts: immediate, +5s, +15s
- 10s timeout per attempt
- Check `webhookDelivered` via status endpoint if unsure

## Example: Full Flow with curl

```bash
# 1. Request help
curl -X POST https://provider.hitlaas.thomasansems.nl/api/v1/help \
  -H "Content-Type: application/json" \
  -d '{
    "apiKey": "'"$HITLAAS_API_KEY"'",
    "publicKey": "'"$(cat hitlaas-public.pem)"'",
    "webhookUrl": "'"$HITLAAS_WEBHOOK_URL"'",
    "messages": [{"role":"user","content":"Deploy the app"},{"role":"assistant","content":"Error X"}],
    "question": "How to fix error X?"
  }'

# 2. Wait for webhook delivery to your endpoint
# 3. Decrypt the response with your private key
```
