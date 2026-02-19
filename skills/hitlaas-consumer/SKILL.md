# HITLaaS Consumer Skill

## What is HITLaaS?
Human-In-The-Loop as a Service. When you (an AI agent) get stuck, you request help from a human expert via a simple API. The response is retrieved by polling — no webhooks, no public URLs needed.

## Configuration
- `HITLAAS_API_KEY` — your provider API key
- `HITLAAS_BASE_URL` — API base URL (default: `https://hitlaas-platform.vercel.app`)

## Security
All communication is **E2E encrypted**:
- You generate an RSA key pair locally
- Send your **public key** with the request
- Messages are encrypted at rest on the server
- The response comes back encrypted with your public key
- Only you can decrypt it with your private key
- The server (relay) **never sees plaintext content**

## How It Works

### 1. Generate Key Pair (once, store in workspace)

```bash
openssl genpkey -algorithm RSA -out ~/.hitlaas/private.pem -pkeyopt rsa_keygen_bits:2048
openssl rsa -in ~/.hitlaas/private.pem -pubout -out ~/.hitlaas/public.pem
```

### 2. Submit Help Request

**POST** `{HITLAAS_BASE_URL}/api/v1/help`

```json
{
  "apiKey": "<your-api-key>",
  "publicKey": "<your-RSA-public-key-PEM>",
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
- `messages` — array of conversation messages (last 10 kept)

**Optional:**
- `question` — specific question for the expert

**Response:**
```json
{
  "requestId": "clxyz...",
  "refCode": "HTL-AB12",
  "status": "pending",
  "serverPublicKey": "-----BEGIN PUBLIC KEY-----...",
  "expiresAt": "2026-02-21T00:00:00.000Z"
}
```

### 3. Poll for Response (Smart Polling)

**GET** `{HITLAAS_BASE_URL}/api/v1/help/{requestId}`

**Polling strategy — two phases:**

#### Phase 1: Active polling (first hour)
Poll every 10 seconds in a loop. This handles urgent requests where a human responds quickly.

```bash
# Poll loop (run in background)
for i in $(seq 1 360); do
  RESULT=$(curl -s "${HITLAAS_BASE_URL}/api/v1/help/${REQUEST_ID}")
  STATUS=$(echo "$RESULT" | jq -r '.status')
  
  if [ "$STATUS" = "responded" ]; then
    ENCRYPTED=$(echo "$RESULT" | jq -r '.encryptedResponse')
    # Decrypt and use the response
    break
  elif [ "$STATUS" = "expired" ]; then
    echo "Request expired — no human responded"
    break
  fi
  
  sleep 10
done
```

#### Phase 2: Cron polling (after 1 hour)
If no response after 1 hour, create an OpenClaw cron job that polls every 5 minutes:

```
Use the cron tool to create an isolated agentTurn job:
- schedule: { kind: "every", everyMs: 300000 }  (every 5 min)
- sessionTarget: "isolated"
- payload.kind: "agentTurn"
- payload.message: "Poll HITLaaS request {requestId}. 
    curl -s {BASE_URL}/api/v1/help/{requestId} | check status.
    If 'responded': decrypt the encryptedResponse, deliver to main session via sessions_send, then disable this cron job.
    If 'expired': notify main session, disable this cron job.
    Otherwise: NO_REPLY"
```

### 4. Response Format

When `status` = `"responded"`:
```json
{
  "requestId": "clxyz...",
  "refCode": "HTL-AB12",
  "status": "responded",
  "encryptedResponse": "<RSA+AES encrypted blob>",
  "respondedAt": "2026-02-20T01:23:45.000Z",
  "expiresAt": "2026-02-21T00:00:00.000Z"
}
```

The `encryptedResponse` is a hybrid RSA-OAEP + AES-256-GCM encrypted string:
`<rsaEncryptedAesKey>.<iv>.<authTag>.<aesCiphertext>` (all base64, dot-separated)

### 5. Decrypt the Response

```bash
# The encryptedResponse format: base64(rsaKey).base64(iv).base64(tag).base64(ciphertext)
# 1. Split on dots
# 2. RSA-OAEP decrypt the AES key with your private key
# 3. AES-256-GCM decrypt the ciphertext with the AES key + IV + auth tag
```

Node.js example:
```javascript
const crypto = require('crypto');
const [encKeyB64, ivB64, tagB64, dataB64] = encryptedResponse.split('.');
const aesKey = crypto.privateDecrypt(
  { key: privateKeyPem, padding: crypto.constants.RSA_PKCS1_OAEP_PADDING },
  Buffer.from(encKeyB64, 'base64')
);
const decipher = crypto.createDecipheriv('aes-256-gcm', aesKey, Buffer.from(ivB64, 'base64'));
decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
const plaintext = Buffer.concat([
  decipher.update(Buffer.from(dataB64, 'base64')),
  decipher.final()
]).toString('utf8');
```

## Statuses

| Status | Meaning |
|---|---|
| `pending` | Waiting for a human expert |
| `reviewing` | Expert has opened the request |
| `responded` | Answer ready — check `encryptedResponse` |
| `expired` | No one answered within 24 hours |

## When to Use
Use HITLaaS when you are **truly stuck** — ambiguous requirements, need domain expertise, blocked by something you can't resolve autonomously. Don't use it for things you can figure out yourself.

## Example: Full Flow with curl

```bash
export HITLAAS_BASE_URL="https://hitlaas-platform.vercel.app"
export HITLAAS_API_KEY="htl_your_key_here"

# 1. Generate keys (once)
mkdir -p ~/.hitlaas
openssl genpkey -algorithm RSA -out ~/.hitlaas/private.pem -pkeyopt rsa_keygen_bits:2048 2>/dev/null
openssl rsa -in ~/.hitlaas/private.pem -pubout -out ~/.hitlaas/public.pem 2>/dev/null

# 2. Submit request
PUBLIC_KEY=$(cat ~/.hitlaas/public.pem)
RESPONSE=$(curl -s -X POST "${HITLAAS_BASE_URL}/api/v1/help" \
  -H "Content-Type: application/json" \
  -d "{
    \"apiKey\": \"${HITLAAS_API_KEY}\",
    \"publicKey\": $(jq -Rs . < ~/.hitlaas/public.pem),
    \"messages\": [{\"role\":\"user\",\"content\":\"Deploy the app\"},{\"role\":\"assistant\",\"content\":\"Error X\"}],
    \"question\": \"How to fix error X?\"
  }")
REQUEST_ID=$(echo "$RESPONSE" | jq -r '.requestId')
echo "Request created: $REQUEST_ID ($(echo "$RESPONSE" | jq -r '.refCode'))"

# 3. Poll (phase 1: every 10s for 1 hour)
for i in $(seq 1 360); do
  POLL=$(curl -s "${HITLAAS_BASE_URL}/api/v1/help/${REQUEST_ID}")
  STATUS=$(echo "$POLL" | jq -r '.status')
  echo "[$i] Status: $STATUS"
  [ "$STATUS" = "responded" ] && echo "Got response!" && break
  [ "$STATUS" = "expired" ] && echo "Expired" && break
  sleep 10
done
```
