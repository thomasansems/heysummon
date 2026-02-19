```skill
# HITLaaS Provider Skill

## What You Are
You are a HITLaaS provider. AI agents that get stuck send help requests through the relay. Your job is to:
1. Receive incoming requests via your registered provider webhook
2. Fetch and decrypt the encrypted messages
3. Present them to your human user
4. Send the human's response back via the relay API

## Configuration

| Variable | Description |
|---|---|
| `HITLAAS_API_KEY` | Your provider API key (`htl_...`) — passed as `x-api-key` header |
| `HITLAAS_RELAY_URL` | Relay base URL (default: `http://localhost:4000`) |

**One-time setup:** Register your `providerWebhookUrl` on your API key via the platform dashboard (API Keys → set Webhook URL).

## Startup (run once)

Register your webhook URL before going live. The relay will push new requests here automatically.

```bash
export HITLAAS_API_KEY=htl_xxx
export HITLAAS_PLATFORM_URL=http://localhost:3000

./scripts/register-webhook.sh https://your-provider.com/hitlaas/incoming
```

Calls `PATCH /api/keys` authenticated by `x-api-key` header only — no session or user credentials needed.

## Workflow

### 1. Receive New Request (webhook push)

The relay POSTs to your registered `providerWebhookUrl`:

```json
{
  "event": "new_request",
  "requestId": "abc123",
  "refCode": "HTL-AB12",
  "createdAt": "2026-02-20T10:00:00.000Z",
  "expiresAt": "2026-02-20T10:30:00.000Z"
}
```

### 2. Fetch Encrypted Messages

**GET** `/api/v1/relay/messages/{requestId}`  
Header: `x-api-key: htl_your_key`

```json
{
  "encryptedMessages": "<ciphertext>",
  "serverPrivateKey": "-----BEGIN PRIVATE KEY-----...",
  "requestId": "abc123",
  "refCode": "HTL-AB12"
}
```

Decrypt `encryptedMessages` with `serverPrivateKey` (RSA-OAEP + AES-256-GCM). Plaintext: `{ messages, question }`

### 3. Check Pending Requests (fallback polling)

**GET** `/api/v1/relay/pending`  
Header: `x-api-key: htl_your_key`

### 4. Present to Human

```
🆘 Help Request [HTL-AB12]
Question: How do I fix deployment error X?

Context:
  User: Deploy the app
  Assistant: Got error X, tried Y and Z

Your answer:
```

### 5. Send Response

**POST** `/api/v1/relay/respond/{requestId}`  
Headers: `x-api-key: htl_your_key`, `Content-Type: application/json`

```json
{ "response": "The human expert's answer..." }
```

The relay immediately POSTs the response to the consumer's `callbackUrl`.

## Helper Scripts

```bash
export HITLAAS_API_KEY=htl_xxx
export HITLAAS_RELAY_URL=http://localhost:4000

./scripts/register-webhook.sh https://your-provider.com/hitlaas/incoming  # run once at startup
./scripts/poll-requests.sh                                                  # fallback: check pending
./scripts/respond.sh <requestId> "Your answer here"                        # send a response
```
```
