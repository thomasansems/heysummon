# HITLaaS Platform — Human in the Loop as a Service

Open-source platform that connects AI agents with human experts when they get stuck. **E2E encrypted, polling-based, zero-knowledge.**

## How It Works

```
🤖 AI Agent gets stuck
    │
    ├─ POST /api/v1/help  (encrypted messages + public key)
    │
    ▼
📦 HITLaaS Platform  (stores encrypted — cannot read content)
    │
    ├─ Provider sees request in dashboard
    ├─ Decrypts with server key → reads → types answer
    │
    ▼
🤖 AI Agent polls GET /api/v1/help/:id
    │
    ├─ Gets response encrypted with its public key
    ├─ Decrypts with private key → continues work
    ▼
    ✅ Done
```

### Key Design Decisions

- **Polling, not webhooks** — no public URLs needed. Works behind NAT, firewalls, localhost.
- **E2E encrypted** — RSA-OAEP + AES-256-GCM. Messages encrypted at rest, responses encrypted in transit.
- **Zero-knowledge relay** — platform cannot read message content.
- **Smart two-phase polling** — 10s intervals for first hour, then cron every 5 min.
- **Open source** — self-host or use the cloud version.

## Features

- 🔐 **E2E encryption** — RSA-OAEP + AES-256-GCM hybrid
- 📊 **Provider dashboard** — OAuth login (GitHub/Google), request management
- 🔑 **API keys** — manage consumer API keys
- 📎 **Reference codes** — `HTL-XXXX` for easy tracking
- ⏱️ **24h expiry** — requests auto-expire
- 🔄 **Smart polling** — fast initial polling, cron fallback

## Quick Start

```bash
git clone https://github.com/thomasansems/hitlaas-platform.git
cd hitlaas-platform
npm install
cp .env.example .env.local  # edit with your credentials
npx prisma generate && npx prisma db push
npx prisma db seed  # optional: creates test user + sample data
npm run dev
```

## For AI Agents (Consumer)

Your agent submits a help request and polls for the answer:

```bash
# 1. Submit request (with your RSA public key for E2E encryption)
curl -X POST https://hitlaas-platform.vercel.app/api/v1/help \
  -H "Content-Type: application/json" \
  -d '{
    "apiKey": "htl_your_key",
    "publicKey": "-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----",
    "messages": [{"role":"user","content":"Fix this"},{"role":"assistant","content":"Stuck on X"}],
    "question": "How to resolve X?"
  }'
# Returns: { requestId, refCode, status: "pending", serverPublicKey, expiresAt }

# 2. Poll for response (every 10s)
curl https://hitlaas-platform.vercel.app/api/v1/help/REQUEST_ID
# When responded: { status: "responded", encryptedResponse: "..." }

# 3. Decrypt encryptedResponse with your private key
```

**Polling strategy:**
- **First hour**: poll every 10 seconds (fast turnaround)
- **After 1 hour**: create an OpenClaw cron job polling every 5 minutes
- **24 hours**: request expires

See `skills/hitlaas-consumer/SKILL.md` for the full integration guide.

## For Human Experts (Provider)

Log in to the dashboard, view incoming requests, and respond:

1. Go to `/dashboard/requests`
2. Click a pending request — messages are decrypted for viewing
3. Type your answer and submit
4. The consumer's next poll picks up your encrypted response

See `skills/hitlaas-provider/SKILL.md` for OpenClaw integration.

## Self-Hosted vs Cloud

| | Self-Hosted | Cloud |
|---|---|---|
| **Deploy** | Your own server | `hitlaas-platform.vercel.app` |
| **Database** | SQLite, Postgres, etc. | Managed |
| **Control** | Full | Managed |
| **Cost** | Free | Free tier |

## Environment Variables

```env
DATABASE_URL="file:./dev.db"
NEXTAUTH_SECRET="your-secret"
NEXTAUTH_URL="http://localhost:3000"
GITHUB_ID="..."
GITHUB_SECRET="..."
GOOGLE_ID="..."
GOOGLE_SECRET="..."
```

## Tech Stack

- **Next.js 15** + App Router
- **Prisma** + SQLite (swap to Postgres easily)
- **NextAuth.js v5** — GitHub + Google OAuth
- **Tailwind CSS** + shadcn/ui + Geist font
- **RSA-OAEP + AES-256-GCM** — hybrid E2E encryption

## Relay Service

The `relay/` directory contains a standalone Express server for self-hosted deployments. See `relay/README.md`.

## Skills

- `skills/hitlaas-consumer/` — For AI agents that need human help
- `skills/hitlaas-provider/` — For human experts using OpenClaw

## API Reference

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `POST` | `/api/v1/help` | API key | Submit encrypted help request |
| `GET` | `/api/v1/help/:id` | None | Poll status + get encrypted response |
| `GET` | `/api/requests` | Session | List requests (provider dashboard) |
| `GET` | `/api/requests/:id` | Session | View decrypted request (provider) |
| `PATCH` | `/api/requests/:id` | Session | Submit response (provider) |
| `GET` | `/api/keys` | Session | List API keys |
| `POST` | `/api/keys` | Session | Create API key |

## License

MIT
