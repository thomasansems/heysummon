# HeySummon Launch Plan

*Created: 2026-03-25 | Launch target: Friday 2026-03-28*

---

## Launch Goal

Establish HeySummon as the default HITL infrastructure layer for AI agent developers.

**Primary metrics (launch week):**
- GitHub stars
- Cloud waitlist signups
- Hacker News Show HN upvotes / comments
- Product Hunt ranking

**Conversion actions:**
- Star on GitHub
- Join cloud waitlist at cloud.heysummon.ai
- Run `npx heysummon`

---

## Phase 1: Pre-Launch (before Friday)

### Landing Page — Option A (single page, ship by Friday)

Build a marketing landing page at `heysummon.ai`. The current `website/` is docs-only (Nextra). A separate marketing page is needed.

**Page sections (in order):**
1. **Hero** — "Hey summon JohnDoe" — the HITL API for AI agents
   - Subheadline: When your agent hits a wall, it summons a human.
   - CTAs: `npx heysummon` code block | "Join cloud waitlist"
2. **Problem** — The moment: your agent is about to do something irreversible
3. **How it works** — 3-step: Agent asks → Human answers → Agent continues
4. **Features** — E2E encrypted · Self-hostable · Platform-agnostic · Open source
5. **Quick install** — `npx heysummon` — 2 min, no Docker required
6. **Integrations** — Claude Code · Codex · n8n · any HTTP client
7. **Open source** — Sustainable Use License · GitHub · free forever
8. **CTA footer** — Join waitlist + GitHub star

**Tech:** New Next.js page in `website/` or standalone. Keep docs at `docs.heysummon.ai`.

**Status:** [ ] Not started

---

### Cloud Waitlist Page

Simple page at `cloud.heysummon.ai` or `heysummon.ai/cloud`:
- Email capture form
- What cloud will include (teams, analytics, managed infra)
- No pricing yet

**Status:** [ ] Not started

---

### README Tightening

- Logo visible above the fold
- "A pager for your AI agents" as the hero line
- `npx heysummon` as the first thing to try
- Remove emoji from headings for professional tone

**Status:** [ ] Not started

---

### Demo Asset

A 60-second GIF or video showing the full loop:
- Agent sends a question
- Dashboard shows the request
- Human responds
- Agent continues

**Status:** [ ] Not started

---

### Product Hunt Listing

Prepare the listing before launch day:
- Tagline: The human-in-the-loop API for AI agents
- Description: 3 paragraphs — problem, solution, differentiators
- 3-5 screenshots: dashboard, code snippet, architecture
- Short demo video/GIF
- First comment: the story behind it

**Status:** [ ] Not started

---

## Phase 2: Launch Day (Friday)

Execute in this order:

| Time | Action | Channel |
|------|--------|---------|
| 8am EST | Post Show HN | Hacker News |
| 8:30am EST | Post X/Twitter thread | Twitter/X |
| 9am EST | Post Product Hunt listing | Product Hunt |
| 9am EST | Post to LinkedIn | LinkedIn |
| 10am EST | Post to subreddits | r/MachineLearning, r/LocalLLaMA, r/selfhosted |
| 10am EST | Post to Indie Hackers | indiehackers.com |
| All day | Respond to every comment | All channels |

---

### Hacker News — Show HN

**Title:** `Show HN: HeySummon – open-source human-in-the-loop API for AI agents`

**Post body draft:**
```
My AI coding agent deleted something it shouldn't have. There was no way to stop it — it just proceeded.

HeySummon is an open-source HITL platform: when an AI agent needs approval or is stuck, it sends an encrypted help request to a human. The human responds via a dashboard or Telegram. The agent picks up the response and continues.

Key properties:
- E2E encrypted (X25519 + AES-256-GCM) — the server never reads messages
- Self-hostable — npx heysummon or Docker, 2 minutes
- Platform-agnostic — works with Claude Code, Codex, n8n, or any HTTP client
- Open source — Sustainable Use License

GitHub: [link]
Docs: docs.heysummon.ai
Cloud waitlist: cloud.heysummon.ai
```

---

### X/Twitter Thread

5 tweets:
1. Hook: the agent-deletes-something-irreversible story
2. What HeySummon does (code snippet showing `hs.ask()`)
3. How it works (3-step diagram or GIF)
4. Key differentiators (E2E, self-hosted, platform-agnostic)
5. CTA: GitHub + cloud waitlist

---

## Phase 3: Post-Launch (week after)

### Site Architecture — Option B (classic SaaS split)

After launch week, expand heysummon.ai to a multi-page marketing site:

```
heysummon.ai
├── / (homepage — same as launch page)
├── /self-hosting   (self-hosters pitch: Docker, NPX, full control, free forever)
├── /security       (E2E encryption, zero-knowledge, OWASP ZAP, CodeQL)
├── /cloud          (waitlist → team features, managed infra)
├── /open-source    (license, contributing, community)
└── /changelog      (releases — signals active development)

docs.heysummon.ai — unchanged (Nextra)
cloud.heysummon.ai — unchanged (product)
```

**Priority order for post-launch pages:**
1. `/self-hosting` — addresses top objection ("I don't want another service")
2. `/cloud` — captures waitlist, explains what's coming
3. `/security` — addresses privacy/enterprise concern
4. `/open-source` — speaks to OSS community
5. `/changelog` — builds retention and shows active development

**Status:** [ ] Planned for post-launch

---

### Long-term: Option C additions

Once traction is established:
- `/integrations/claude-code` — capture "claude code human in loop" searches
- `/integrations/n8n` — capture automation audience
- `/integrations/codex` — capture Codex/OpenAI agent audience
- `/compare/langchain-checkpoints` — capture evaluation-stage traffic
- `/blog` — content strategy for HITL/AI agents category

---

## Target Audiences

| Audience | Where to reach | Message |
|----------|---------------|---------|
| AI / agent developers | Hacker News, X/Twitter, GitHub | E2E encrypted, self-hostable, drop-in API |
| Technical founders / entrepreneurs | X/Twitter, LinkedIn | Oversight without slowing agents down |
| Indie hackers / automation builders | Indie Hackers, r/LocalLLaMA, X/Twitter | Free forever, 2-min setup, open source |
| Self-hosters | r/selfhosted, HN | Full control, Docker, no vendor lock-in |

---

## Channels to Create (content plan — after launch)

*This section will be populated when channel content is planned.*

- [ ] X/Twitter thread series
- [ ] LinkedIn posts
- [ ] Reddit posts (r/MachineLearning, r/LocalLLaMA, r/selfhosted, r/programming)
- [ ] Indie Hackers post
- [ ] Dev.to / Hashnode article
- [ ] Product Hunt follow-up posts

---

## Open Items

- [ ] Where does heysummon.ai live? (currently unclear — docs.heysummon.ai is Nextra, need marketing site)
- [ ] Cloud waitlist mechanism — email tool? (Mailchimp, Resend, etc.)
- [ ] Demo GIF/video creation
- [ ] Product Hunt — posting yourself or need a hunter?
