# Quickstart

Get HeySummon running and send your first help request in under 5 minutes.

---

## Option 1: NPX (fastest)

```bash
npx heysummon
```

The interactive installer handles everything: download, secrets, database, and starts the server on port 3000.

```bash
heysummon start -d   # start in background
heysummon stop       # stop the server
heysummon status     # check if running
heysummon update     # update to latest version
```

Jump to [step 4](#4-create-an-api-key) once it's running.

---

## Option 2: Docker (recommended for production)

```bash
git clone https://github.com/thomasansems/heysummon.git
cd heysummon
cp .env.example .env
```

Set the required secrets in `.env`:

```bash
NEXTAUTH_SECRET=        # openssl rand -hex 32
MERCURE_JWT_SECRET=     # openssl rand -hex 32
```

Then start:

```bash
docker compose up -d
```

HeySummon is now running at `http://localhost:3445` (behind the Guard proxy).

---

## Option 3: Local development

```bash
git clone https://github.com/thomasansems/heysummon.git
cd heysummon
npm install
cp .env.example .env.local
npx prisma migrate dev
npm run dev
```

Open `http://localhost:3000`.

---

## 4. Create an API key

1. Open the dashboard at `http://localhost:3000` (or `:3445` for Docker)
2. **Sign up** — the first user becomes admin; registration closes after that
3. Go to **API Keys** → **Create Key**
4. Copy the key — it's only shown once

Keys follow this format:
```
hs_live_abc123...    # client key (for AI agents)
hs_prov_abc123...    # provider key (for watchers/integrations)
```

---

## 5. Send your first request

```bash
curl -X POST http://localhost:3000/api/v1/help \
  -H "Content-Type: application/json" \
  -H "x-api-key: YOUR_API_KEY" \
  -d '{
    "question": "Should I proceed with deleting the production database?",
    "apiKey": "YOUR_API_KEY"
  }'
```

Response:

```json
{
  "requestId": "cmxxx...",
  "refCode": "HS-A1B2C3D4",
  "status": "pending"
}
```

---

## 6. Respond in the dashboard

1. Open the dashboard — you'll see the request with reference code `HS-A1B2C3D4`
2. Click it, read the decrypted message, type your response
3. Click **Respond**

---

## 7. Poll for the response

```bash
curl http://localhost:3000/api/v1/help/cmxxx... \
  -H "x-api-key: YOUR_API_KEY"
```

```json
{
  "status": "responded",
  "response": "No, do not delete the production database."
}
```

---

## Next steps

- [API Reference](./api/overview.md) — All endpoints
- [E2E Encryption](./guides/encryption.md) — How keys and ciphertext work
- [Real-time SSE](./guides/sse.md) — Stream responses instead of polling
- [Provider Conversations](./guides/provider-conversations.md) — Reply via Telegram
