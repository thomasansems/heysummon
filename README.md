# HITLaaS Platform — Human in the Loop as a Service

Open-source provider portal for HITLaaS. Connect your human expertise to AI agents that need help.

## What is HITLaaS?

When AI agents get stuck, they can request human help via a simple REST API. As a **provider**, you receive these requests, resolve them, and send the answer back — all through this dashboard.

## Features

- 🔐 **OAuth login** — GitHub & Google
- 📊 **Dashboard** — overview, stats, request management
- 🔑 **API keys** — manage provider API keys
- 🔒 **E2E encryption** — RSA-OAEP + AES-256-GCM hybrid encryption
- 📎 **Reference codes** — `HTL-XXXX` for easy request tracking
- 🤖 **WebMCP** — expose tools to AI agents via browser API

## Quick Start

```bash
# Clone
git clone https://github.com/thomasansems/hitlaas-platform.git
cd hitlaas-platform

# Install
npm install

# Set up environment
cp .env.example .env.local
# Edit .env.local with your credentials

# Set up database
npx prisma generate
npx prisma db push

# Seed (optional)
npx prisma db seed

# Run
npm run dev
```

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

## Self-Hosted vs Cloud

| | Self-Hosted | Cloud |
|---|---|---|
| **Deploy** | Your own server | `provider.hitlaas.thomasansems.nl` |
| **Database** | Your choice (SQLite, Postgres, etc.) | Managed |
| **Control** | Full | Managed |
| **Cost** | Free | Free tier available |

## Tech Stack

- **Next.js 15** + App Router
- **Prisma** + SQLite (swap to Postgres/MySQL easily)
- **NextAuth.js v5** — OAuth
- **Tailwind CSS** + shadcn/ui
- **Geist** font family

## Relay Service

The `relay/` directory contains a standalone Express server for message relay with E2E encryption. See `relay/README.md`.

## License

MIT
