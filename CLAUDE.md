# HeySummon Channel Adapters — Implementation Guide

## Overview
Implement the channel adapters architecture across 4 GitHub issues (#75, #76, #77, #78).
This is a Next.js 15 app with Prisma (SQLite), NextAuth, Tailwind CSS, and Playwright e2e tests.

## Issue #75: Rename Provider → UserProfile + ChannelProvider model

### Database changes (prisma/schema.prisma):
1. Rename `Provider` model to `UserProfile` (keep all existing fields)
2. Add `ChannelProvider` model:

```prisma
model ChannelProvider {
  id              String   @id @default(cuid())
  profileId       String
  profile         UserProfile @relation(fields: [profileId], references: [id], onDelete: Cascade)
  type            String   // "openclaw" | "telegram"
  name            String
  isActive        Boolean  @default(true)
  config          String   @default("{}")  // JSON, type-specific
  pairingCode     String?  @unique
  pairingExpires  DateTime?
  paired          Boolean  @default(false)
  lastHeartbeat   DateTime?
  status          String   @default("disconnected")
  errorMessage    String?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  @@index([profileId])
  @@index([type])
}
```

3. Add `channelProviders ChannelProvider[]` relation to UserProfile
4. Run `npx prisma migrate dev --name channel-adapters`

### UI Renames:
- Navigation: "Providers" label → "Users" (href stays /dashboard/providers for now, will move later)
- Add new nav item: { label: "Channels", href: "/dashboard/channels" } between Users and Clients
- Update sidebar.tsx navItems too
- Update top-nav.tsx navItems

### API:
- Keep existing /api/providers routes working (they now manage UserProfile)
- Create new /api/channels routes for ChannelProvider CRUD

## Issue #78: Channel Providers UI

### New page: /dashboard/channels/page.tsx
- List all ChannelProviders for current user
- Show: name, type (with icon), status badge (connected/disconnected/error), created date
- "New Channel" button → opens creation flow
- Each row: Settings link, Activate/Deactivate toggle, Delete button

### New page: /dashboard/channels/new/page.tsx
- Step 1: Choose type (OpenClaw card, Telegram card, WhatsApp card greyed out "Coming soon")
- Step 2: Type-specific form
  - OpenClaw: name + API key
  - Telegram: name + bot token (with validation)
- Creates ChannelProvider via POST /api/channels

### New page: /dashboard/channels/[id]/settings/page.tsx
- General section: name, status, last heartbeat
- Type-specific settings section
- Routing section: welcome message, away message
- Danger zone: delete

### Style: Match existing Vercel-like design (white bg, #eaeaea borders, black text, violet accents)

## Issue #76: OpenClaw adapter

### /api/channels route handlers:
- GET /api/channels → list user's channel providers
- POST /api/channels → create (validate based on type)
- PATCH /api/channels/[id] → update config
- DELETE /api/channels/[id] → delete

### OpenClaw type config:
```typescript
interface OpenClawConfig {
  apiKey: string;
  webhookUrl?: string;
}
```

## Issue #77: Telegram adapter

### Validation on create:
```typescript
// When type === "telegram", validate bot token:
const res = await fetch(`https://api.telegram.org/bot${token}/getMe`);
// Store botUsername in config
```

### Webhook endpoint: /api/adapters/telegram/[id]/webhook/route.ts
- Verify x-telegram-bot-api-secret-token header
- Parse update.message
- Find or create HelpRequest for this chat_id + provider
- Add message to request
- Publish Mercure event for real-time UI update

### On create: set webhook
```typescript
const webhookUrl = `${process.env.NEXTAUTH_URL}/api/adapters/telegram/${id}/webhook`;
await fetch(`https://api.telegram.org/bot${token}/setWebhook`, { ... });
```

### On delete: remove webhook
```typescript
await fetch(`https://api.telegram.org/bot${token}/deleteWebhook`);
```

### Response flow:
When user responds to a request that came from Telegram, send via bot API:
- Check if request has a channelProviderId + consumerChatId
- If so, send response via Telegram sendMessage

### Add to HelpRequest model:
```prisma
  channelProviderId  String?
  channelProvider    ChannelProvider? @relation(fields: [channelProviderId], references: [id])
  consumerChatId     String?  // External chat identifier (Telegram chat_id, etc.)
  consumerName       String?  // Display name from external channel
```

And add `requests HelpRequest[]` to ChannelProvider.

## E2E Tests

### Extend tests/e2e/dashboard.spec.ts:
- Test channels page redirects when unauthenticated
- Test channels page loads when authenticated

### New: tests/e2e/channels.spec.ts:
- Test channel CRUD flow (create OpenClaw channel, verify in list, delete)
- Test Telegram channel creation with mocked bot validation
- Test channel settings page renders correctly

### New: tests/e2e/telegram-webhook.spec.ts or unit test:
- Test webhook endpoint receives Telegram update and creates request
- Test webhook rejects invalid secret
- Test response sends message back via Telegram API (mock fetch)

## Important Notes
- Keep the existing /api/providers and /dashboard/providers pages working — they manage UserProfiles now
- Use the same Vercel-like design system (white, #eaeaea borders, black text, violet-600 accents)
- All config stored as JSON string in ChannelProvider.config
- Telegram API calls should be in a separate lib file: src/lib/adapters/telegram.ts
- OpenClaw adapter logic in: src/lib/adapters/openclaw.ts
- Shared adapter interface in: src/lib/adapters/types.ts

When completely finished, run this command to notify me:
openclaw system event --text "Done: HeySummon channel adapters implemented — all 4 issues (#75-#78)" --mode now
