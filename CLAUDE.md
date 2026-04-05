# HeySummon — Claude Code Guidelines

## What is HeySummon?

HeySummon is an open-source **Human-in-the-Loop (HITL) platform for AI agents**. When AI
agents get stuck, need approval, or lack context, they send an encrypted help request to
a human expert who responds through the dashboard. The agent then continues its workflow.

The product is currently **self-hosted only** — there is no managed cloud offering yet.

**Key concepts:**

- **Consumer** — AI agent or app requesting help (authenticates via API key)
- **Expert** — Human expert who reviews and responds to requests
- **HelpRequest** — Encrypted request with lifecycle: pending -> active -> closed/expired
- **Channel** — Notification channel (Telegram, Slack) for alerting experts
- **Guard** — Ed25519 request-signing reverse proxy (entry point)

## Tech Stack

- **Next.js 16** with App Router and React Server Components
- **Prisma 6** — SQLite (dev/CLI) or PostgreSQL (Docker/production)
- **NextAuth.js v5** — Authentication (email/password, optional OAuth)
- **shadcn/ui + Radix UI + Tailwind CSS 4** — UI components
- **X25519 + AES-256-GCM** — End-to-end encryption
- **Ed25519** — Request signing (Guard proxy)
- **Vitest** — Unit tests
- **Playwright** — E2E tests

## Project Structure

```
src/
├── app/
│   ├── api/v1/         # Consumer-facing API (help, messages, events, keys)
│   ├── api/adapters/   # Webhook adapters (Telegram, Slack)
│   ├── api/admin/      # Admin operations
│   ├── dashboard/      # Expert dashboard (requests, clients, channels)
│   ├── auth/           # Login, signup, verify
│   └── onboarding/     # First-time expert setup
├── components/
│   ├── ui/             # shadcn/ui components
│   ├── dashboard/      # Dashboard-specific components
│   └── landing/        # Marketing/landing page components
├── lib/                # Shared utilities, adapters, encryption
└── services/           # Business logic
cli/                    # NPX installer (`npx @heysummon/app`)
guard/                  # Ed25519 signing reverse proxy
packages/consumer-sdk/  # Consumer SDK
prisma/                 # Schema and migrations
website/                # Documentation site (docs.heysummon.ai)
landingspage/           # Marketing website (heysummon.ai)
vercel-waitlist/        # Cloud waitlist site (cloud.heysummon.ai) — placeholder until cloud product exists
skills/                 # Claude Code / AI tool skills
```

## Common Commands

```bash
pnpm dev              # Start dev server (port 3425)
pnpm build            # Production build
pnpm test             # Unit tests (Vitest)
pnpm test:e2e         # E2E tests (Playwright)
pnpm test:all         # All tests
pnpm lint             # ESLint
pnpm db:studio        # Prisma Studio
pnpm db:seed          # Seed sample data
```

## Documentation

### Single source of truth

All user-facing documentation lives in **`/website/pages/`**. The `/docs/` directory
contains legacy markdown files kept for reference — do not treat it as the live docs.

### Keep docs in sync with code

**When you change a feature, update the documentation.** This is not optional.

- API endpoints changed -> update `/website/pages/reference/api.mdx`
- CLI, Docker, or NPX installer changed -> update `/website/pages/self-hosting/`
- Auth, keys, or encryption changed -> update `/website/pages/security/`
- Dashboard, Telegram, or events changed -> update `/website/pages/expert/`
- New top-level feature -> create page in appropriate section, add to `_meta.js`

### Changelog

Every meaningful change goes in `/website/pages/reference/changelog.mdx`, newest first:

```md
## vX.Y.Z — YYYY-MM-DD

### Added / Changed / Fixed
- Short description
```

## Development

- Develop on feature branches, never directly on `main`
- Docs auto-deploy to `docs.heysummon.ai` on push to `main`
- Run unit and E2E tests before opening a PR

### Database

- Schema: `prisma/schema.prisma`
- Migrations: `pnpm exec prisma migrate dev --name <description>`
- Never edit migration files after they have been applied

## Deployment Options

| Method | Database | Port |
|--------|----------|------|
| `pnpm dev` | SQLite | 3425 |
| `npx @heysummon/app` | SQLite | 3435 |
| Docker Compose | PostgreSQL | 3445 |

## Security

- Never log or expose API keys, secrets, or private keys
- Content safety middleware runs in-process on API routes — do not remove or skip it
- E2E encryption is opt-in for consumers — the platform must never store plaintext for encrypted requests
- Guard proxy validates and signs all inbound consumer requests
