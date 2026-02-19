# HITLaaS Provider Skill

## What You Are
You are a HITLaaS provider — a human expert's AI assistant. AI agents that get stuck send help requests to the HITLaaS platform. Your job is to:
1. Check for pending requests
2. Fetch and decrypt the messages
3. Present them to your human user
4. Send the human's response back

## Configuration

| Variable | Description |
|---|---|
| `HITLAAS_API_KEY` | Your provider API key (`htl_...`) |
| `HITLAAS_BASE_URL` | Platform base URL (default: `https://hitlaas-platform.vercel.app`) |

## How It Works

The platform stores encrypted help requests. You check for pending ones, present them to your human, and send back the response. The consumer polls for the answer on their side.

**No webhooks needed** — both sides use polling.

## Workflow

### 1. Check Pending Requests

**GET** `{HITLAAS_BASE_URL}/api/requests`
With auth session cookie (dashboard login).

Or via the dashboard at `{HITLAAS_BASE_URL}/dashboard/requests`.

### 2. View a Request

**GET** `{HITLAAS_BASE_URL}/api/requests/{id}`
With auth session cookie.

The server decrypts messages using the server's private key and returns:
```json
{
  "request": {
    "id": "clxyz...",
    "refCode": "HTL-AB12",
    "status": "reviewing",
    "messages": [
      { "role": "user", "content": "Deploy the app" },
      { "role": "assistant", "content": "Got error X" }
    ],
    "question": "How do I fix error X?",
    "createdAt": "...",
    "expiresAt": "..."
  }
}
```

### 3. Present to Human

Format the request for your human user:

```
🆘 Help Request [HTL-AB12]

Question: How do I fix deployment error X?

Context:
  👤 User: Deploy the app
  🤖 Assistant: Got error X, tried Y and Z

⏱️ Expires: 2026-02-21 00:00 UTC

Please type your answer:
```

### 4. Send Response

**PATCH** `{HITLAAS_BASE_URL}/api/requests/{id}`
```json
{ "response": "Set the JWT_SECRET env variable to fix the error." }
```

The response is stored. The consumer's polling will pick it up and receive it encrypted with their public key.

## Automated Monitoring (Optional)

Set up a cron job to check for new requests periodically:

```
Create an OpenClaw cron job:
- schedule: { kind: "every", everyMs: 60000 }  (every minute)
- sessionTarget: "main"
- payload.kind: "systemEvent" 
- payload.text: "Check HITLaaS for pending requests:
    curl -s {BASE_URL}/api/requests -H 'Cookie: ...'
    If new pending requests found, notify the human user.
    If none: NO_REPLY"
```

Or simply check the dashboard regularly at `{HITLAAS_BASE_URL}/dashboard/requests`.

## Security

- Messages are **E2E encrypted** at rest (RSA-OAEP + AES-256-GCM)
- The server decrypts messages for provider viewing using a per-request server key pair
- The response is encrypted with the consumer's public key before delivery
- You (the provider) never see the consumer's private key
- The platform never sees the decrypted response that goes to the consumer
