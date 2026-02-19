# HITLaaS Provider Portal — Redesign Plan v2

## Kernbeslissingen

### 1. OAuth Login (Geen Wachtwoorden)
- **GitHub OAuth** als primaire login (providers zijn developers)
- **Google OAuth** als alternatief
- Unlimited gebruikers — iedereen kan provider worden
- Geen signup flow — OAuth maakt automatisch account aan bij eerste login
- NextAuth.js (Auth.js v5) voor OAuth implementatie

### 2. E2E Encrypted Messaging via Azure
- **Azure Communication Services** of **Azure Service Bus** als IaaS voor message relay
- Berichten zijn end-to-end encrypted — HITLaaS kan ze NIET lezen
- Dashboard toont GEEN berichtinhoud — alleen:
  - Statistieken (totaal requests, response time, resolved %)
  - Open/pending requests (alleen status + referentiecode, geen inhoud)
  - Referentiecodes per request (bijv. `HTL-A7X9`) om in chat op te zoeken

### 3. Referentiecodes
- Elk help request krijgt een korte unieke code: `HTL-XXXX` (4 alfanumeriek)
- Provider kan in Telegram zoeken op deze code
- Dashboard toont alleen: code + status + timestamp + client naam
- Geen messages, geen question, geen response in dashboard

### 4. Dashboard Design: Vercel-Inspired
- **Light mode** als default (warm, clean)
- Vercel-style: minimalistisch, veel whitespace, subtiele borders
- Geist font (of Inter als fallback)
- Monochrome met accent kleur
- Sidebar navigatie zoals Vercel (project selector, compact nav)

### 5. Testing
- **Vitest** voor unit tests (al geconfigureerd)
- **Playwright** voor E2E tests (login flow, dashboard, key management)
- Tests draaien voor elke deployment

---

## Architectuur

### Tech Stack
```
Auth:       NextAuth.js v5 (Auth.js) — GitHub + Google OAuth
E2E Relay:  Azure Communication Services (encrypted messaging)
DB:         SQLite (dev) → Turso (prod) — via Prisma
UI:         Next.js 16 + Tailwind + Geist font
Testing:    Vitest (unit) + Playwright (E2E)
Deploy:     Vercel
```

### Database Schema (Nieuw)

```prisma
model User {
  id                  String    @id @default(cuid())
  email               String    @unique
  name                String?
  image               String?
  onboardingComplete  Boolean   @default(false)
  expertise           String?   // JSON array of tags
  notificationPref    String    @default("email")
  telegramChatId      String?
  apiKeys             ApiKey[]
  requests            HelpRequest[] @relation("ExpertRequests")
  accounts            Account[]
  sessions            Session[]
  createdAt           DateTime  @default(now())
  updatedAt           DateTime  @updatedAt
}

model Account {
  id                String  @id @default(cuid())
  userId            String
  type              String
  provider          String
  providerAccountId String
  refresh_token     String?
  access_token      String?
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String?
  session_state     String?
  user              User    @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@unique([provider, providerAccountId])
}

model Session {
  id           String   @id @default(cuid())
  sessionToken String   @unique
  userId       String
  expires      DateTime
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model ApiKey {
  id        String        @id @default(cuid())
  key       String        @unique
  name      String?
  userId    String
  user      User          @relation(fields: [userId], references: [id])
  isActive  Boolean       @default(true)
  requests  HelpRequest[]
  createdAt DateTime      @default(now())
}

model HelpRequest {
  id            String    @id @default(cuid())
  refCode       String    @unique // HTL-XXXX
  apiKeyId      String
  apiKey        ApiKey    @relation(fields: [apiKeyId], references: [id])
  expertId      String
  expert        User      @relation("ExpertRequests", fields: [expertId], references: [id])
  // NO messages/question/response stored — E2E encrypted via Azure
  status        String    @default("pending") // pending, responded, expired
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
  respondedAt   DateTime?
  expiresAt     DateTime
}
```

### API Routes

```
Auth (NextAuth):
  GET/POST /api/auth/[...nextauth]  — OAuth flows

Dashboard API:
  GET  /api/dashboard/stats         — Aggregated stats only
  GET  /api/keys                    — List user's API keys
  POST /api/keys                    — Create new key
  DEL  /api/keys/[id]               — Deactivate key
  GET  /api/requests                — List requests (refCode + status only)

Public API (v1):
  POST /api/v1/help                 — Create help request (encrypted payload → Azure)
  GET  /api/v1/help/[requestId]     — Check status (no message content)

Azure Relay:
  POST /api/relay/send              — Forward encrypted message to provider
  POST /api/relay/respond           — Provider response back to consumer
```

---

## UI Design: Vercel-Inspired

### Layout
```
┌──────────────────────────────────────────────────────────┐
│ [H] HITLaaS          Overview  Keys  Requests  Settings  │  ← Top nav (not sidebar)
├──────────────────────────────────────────────────────────┤
│                                                          │
│  Overview                                                │
│                                                          │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐   │
│  │ 47      │  │ 3       │  │ 44      │  │ 4m 12s  │   │
│  │ Total   │  │ Open    │  │ Resolved│  │ Avg Time│   │
│  └─────────┘  └─────────┘  └─────────┘  └─────────┘   │
│                                                          │
│  Open Requests                                           │
│  ┌──────────────────────────────────────────────────┐   │
│  │ HTL-A7X9  ●  Pending   claude-code   2m ago      │   │
│  │ HTL-B3K2  ●  Pending   cursor-agent  8m ago      │   │
│  │ HTL-C1M5  ○  Expired   openclaw      1h ago      │   │
│  └──────────────────────────────────────────────────┘   │
│                                                          │
│  Activity (7 days)                                       │
│  ┌──────────────────────────────────────────────────┐   │
│  │  █ █ ██ ███ █ ██ █                               │   │
│  │  Mon Tue Wed Thu Fri Sat Sun                     │   │
│  └──────────────────────────────────────────────────┘   │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

### Design Tokens (Vercel-style)
```
Background:     #fafafa (light) / #000 (dark)
Card bg:        #fff (light) / #111 (dark)
Border:         #eaeaea (light) / #333 (dark)
Text primary:   #000 (light) / #fff (dark)
Text secondary: #666 (light) / #888 (dark)
Accent:         #0070f3 (Vercel blue) of #7c3aed (HITLaaS violet)
Font:           Geist Sans + Geist Mono
Border radius:  8px (cards), 6px (buttons), 9999px (badges)
```

### Key Pages

**Login:** Clean centered card, GitHub + Google OAuth buttons, no form fields
**Onboarding:** 3-step wizard (profile → first key → test)
**Overview:** Stats + open requests (ref codes only) + activity chart
**Keys:** Table with copy buttons, usage count, share instructions
**Requests:** Filterable list with ref codes, status badges, timestamps
**Settings:** Notification preferences, profile, connected accounts

---

## Testing Strategy

### Unit Tests (Vitest)
- WebMCP tool registration + execution (✅ al 15 tests)
- Auth utilities (token generation, session validation)
- API route handlers (mock Prisma, test input validation)
- RefCode generation (uniqueness, format HTL-XXXX)
- Encryption helpers (encrypt/decrypt roundtrip)

### E2E Tests (Playwright)
```
tests/
  e2e/
    auth.spec.ts        — OAuth login flow (mocked provider)
    onboarding.spec.ts  — 3-step wizard completion
    dashboard.spec.ts   — Stats display, no message content visible
    keys.spec.ts        — Create, copy, deactivate keys
    requests.spec.ts    — Filter requests, verify only ref codes shown
    api.spec.ts         — v1/help endpoint, status polling
    landing.spec.ts     — Mode toggle, waitlist signup
```

### CI Pipeline
```yaml
# In package.json scripts:
"test": "vitest run"
"test:e2e": "playwright test"
"test:all": "vitest run && playwright test"
```

---

## Implementatie Volgorde

| Fase | Wat | Prioriteit |
|------|-----|-----------|
| 1 | NextAuth.js setup (GitHub + Google OAuth) | 🔴 Kritiek |
| 2 | Prisma schema migratie (Account, Session, refCode) | 🔴 Kritiek |
| 3 | Login page redesign (OAuth buttons, Vercel-style) | 🔴 Kritiek |
| 4 | Dashboard layout (top nav, Vercel-style, light mode) | 🟡 Hoog |
| 5 | Overview page (stats + ref codes, geen berichten) | 🟡 Hoog |
| 6 | API Keys page (Vercel table style) | 🟡 Hoog |
| 7 | Requests page (ref codes + status only) | 🟡 Hoog |
| 8 | Onboarding wizard | 🟡 Hoog |
| 9 | Azure E2E messaging setup | 🟠 Medium |
| 10 | RefCode generatie in API | 🟠 Medium |
| 11 | Settings page | 🟢 Nice to have |
| 12 | Playwright E2E tests | 🟠 Medium |
| 13 | Unit tests voor nieuwe code | 🟠 Medium |

---

## Wat Verandert

- ❌ Email/password auth → ✅ OAuth (GitHub + Google)
- ❌ Messages zichtbaar in dashboard → ✅ Alleen ref codes + status
- ❌ Dark-only dashboard → ✅ Light mode default (Vercel-style)
- ❌ Sidebar nav → ✅ Top nav (Vercel-style)
- ❌ Password field in DB → ✅ OAuth accounts
- ➕ Referentiecodes (HTL-XXXX)
- ➕ Azure E2E encrypted relay
- ➕ Onboarding wizard
- ➕ Playwright tests
- ➕ Geist font

## Wat Blijft

- ✅ WebMCP integratie
- ✅ API v1 endpoints (enhanced met refCode)
- ✅ Waitlist + Loops integration
- ✅ Landing page
- ✅ Vitest unit tests
