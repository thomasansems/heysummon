# ⚡ HeySummon — Quick Start (5 minutes)

Get HeySummon running locally and submit your first human-in-the-loop request.

---

## Fastest Way: NPX Installer

```bash
npx heysummon
```

That's it. The interactive installer handles everything: download, secrets, config, database, and starts the server. Skip to **Step 6** below once it's running.

Manage afterwards with: `heysummon start -d` · `heysummon stop` · `heysummon status` · `heysummon update`

---

## Manual Setup (Development)

### 1. Prerequisites

| Tool | Version | Required? |
|------|---------|-----------|
| **Node.js** | 18+ | ✅ Yes |
| **npm** | 9+ (ships with Node) | ✅ Yes |
| **Docker** | Any recent version | ❌ Optional (for PostgreSQL/Mercure) |

> **No Docker?** No problem — HeySummon defaults to SQLite, and Mercure (real-time updates) is optional for local dev.

---

### 2. Clone & Install

```bash
git clone https://github.com/thomasansems/heysummon.git
cd heysummon
npm install
```

---

### 3. Environment Setup

```bash
cp .env.example .env
```

Open `.env` and set these two **required** secrets:

```bash
# Generate secrets (copy-paste each output into .env)
openssl rand -hex 32   # → NEXTAUTH_SECRET
openssl rand -hex 32   # → MERCURE_JWT_SECRET
```

The defaults handle everything else for local dev:

| Variable | Default | Notes |
|----------|---------|-------|
| `DATABASE_URL` | `file:./prisma/heysummon.db` | SQLite, zero config |
| `NEXTAUTH_URL` | `http://localhost:3425` | Local dev URL |
| `ENABLE_FORM_LOGIN` | `true` | Email + password login (no OAuth needed) |
| `HEYSUMMON_EDITION` | `community` | Self-hosted edition |

> 💡 See `.env.example` for all available options (OAuth, PostgreSQL, Mercure, etc.)

---

### 4. Database Setup

```bash
npx prisma migrate dev
```

This creates the SQLite database and runs all migrations.

---

### 5. Start the Dev Server

```bash
npm run dev
```

Open **http://localhost:3425** — you should see the HeySummon login page. 🎉

---

## 6. Create Your Account

1. Go to **http://localhost:3425**
2. Click **Sign up** (or register)
3. Enter your email and password
4. You're in! You'll land on the provider dashboard.

---

## 7. Create a Provider + Client Key

1. In the dashboard, navigate to **API Keys** (or Settings → Keys)
2. Click **Create Key**
3. Copy the generated API key — you'll need it in the next step

```
Example key: hs_live_abc123...
```

> ⚠️ Save your key somewhere safe — it's only shown once.

---

## 8. Submit Your First Request

Open a terminal and send a help request:

```bash
curl -X POST http://localhost:3425/api/v1/help \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{
    "message": "What color is the sky?",
    "metadata": {
      "source": "quick-start-test"
    }
  }'
```

You'll get back a response with a request ID and reference code:

```json
{
  "id": "clx...",
  "referenceCode": "HS-1234",
  "status": "pending"
}
```

---

## 9. See It in the Dashboard

1. Go back to **http://localhost:3425** in your browser
2. You'll see your request with reference code **HS-XXXX**
3. Click it to view details, decrypt the message, and type a response
4. The AI agent can poll `GET /api/v1/help/:id` to pick up your answer

---

## What's Next?

- 📖 Read the full [README](./README.md) for architecture details
- 🔐 Learn about [E2E encryption](./README.md) (RSA-OAEP + AES-256-GCM)
- 🐳 Try `docker compose up` for a full PostgreSQL + Mercure setup
- 🧪 Run tests: `npm test`

---

*Having trouble? [Open an issue](https://github.com/thomasansems/heysummon/issues) — we're happy to help!*
