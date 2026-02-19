# HITLaaS Consumer Skill

## What is HITLaaS?
Human-In-The-Loop as a Service. When you (an AI agent) get stuck on a problem, you can request help from a real human expert via the HITLaaS API. You'll get a response you can use to continue your work.

## Configuration
- Set `HITLAAS_API_KEY` environment variable with your API key
- API Base URL: `https://hitlaas.vercel.app`

## When to Use
Use HITLaaS when you are **truly stuck** — e.g. ambiguous requirements, need domain expertise, blocked by something you can't resolve autonomously. Don't use it for things you can figure out yourself.

## How It Works

### 1. Request Help

**POST** `https://hitlaas.vercel.app/api/v1/help`

```json
{
  "apiKey": "<your-api-key>",
  "messages": [
    { "role": "user", "content": "..." },
    { "role": "assistant", "content": "..." }
  ],
  "question": "What specific thing do you need help with?"
}
```

- `messages`: Array of recent conversation messages (last 10 are kept). Each should have `role` and `content`.
- `question`: A clear, specific question for the human expert.

**Response:**
```json
{
  "requestId": "clxyz...",
  "refCode": "HTL-AB12",
  "status": "pending",
  "pollUrl": "/api/v1/help/clxyz..."
}
```

### 2. Poll for Response

**GET** `https://hitlaas.vercel.app/api/v1/help/{requestId}`

Poll every 10-30 seconds. Possible statuses:
- `pending` — waiting for a human
- `reviewing` — human is looking at it
- `responded` — answer is ready (check `response` field)
- `expired` — no one answered within 30 minutes

**Response when answered:**
```json
{
  "requestId": "clxyz...",
  "status": "responded",
  "response": "The human expert's answer..."
}
```

### 3. Use the Response
Once you get a `responded` status, use the `response` field to continue your work.

## Example curl Commands

```bash
# Request help
curl -X POST https://hitlaas.vercel.app/api/v1/help \
  -H "Content-Type: application/json" \
  -d '{
    "apiKey": "'"$HITLAAS_API_KEY"'",
    "messages": [{"role":"user","content":"Deploy the app"},{"role":"assistant","content":"I tried but got error X"}],
    "question": "How do I fix deployment error X?"
  }'

# Poll for response
curl https://hitlaas.vercel.app/api/v1/help/REQUEST_ID_HERE
```

## Helper Scripts
- `scripts/request-help.sh <api-key> <question> [messages-json-file]` — submit a help request
- `scripts/check-status.sh <request-id>` — check the status of a request
