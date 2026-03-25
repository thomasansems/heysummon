# Product Marketing Context

*Last updated: 2026-03-25 — pre-launch*

## Product Overview
**One-liner:** HeySummon is the Human-in-the-Loop API for AI agents — when your agent gets stuck, it summons a human.

**What it does:** HeySummon lets AI agents send encrypted help requests to human experts in real time. The human answers via a dashboard or Telegram, and the agent picks up the response and continues its workflow. It's a structured, encrypted, self-hostable bridge between autonomous AI agents and the humans who oversee them.

**Product category:** Human-in-the-Loop (HITL) platform / AI agent infrastructure / Approval & escalation layer for AI

**Product type:** Open-source SaaS (self-hostable + managed cloud)

**Business model:** Free and open source. Core platform under the Sustainable Use License — free for personal and internal business use, forever. Cloud version (cloud.heysummon.ai) is currently waitlist-only, no pricing yet. Revenue model to be defined post-launch.

---

## Target Audience
**Target companies:** Teams and individuals building AI agents or agentic workflows — from solo indie hackers to startups to enterprise engineering teams.

**Decision-makers:**
- Developers and AI engineers building agentic systems (Claude Code, Codex, n8n, custom agents)
- Technical founders / entrepreneurs running AI-heavy products
- Indie hackers / automation enthusiasts building personal AI workflows
- DevOps / platform engineers managing automated pipelines

**Primary use case:** Give AI agents a safe, structured way to ask a human for help, approval, or context — without breaking the agent's workflow or risking unauthorized destructive actions.

**Jobs to be done:**
- "I need my AI agent to pause and wait for my approval before taking a risky action"
- "I need my automation pipeline to escalate to a human when it hits an edge case it can't handle"
- "I need full-stack oversight of what my AI agents are doing, with end-to-end encryption so sensitive questions stay private"

**Use cases:**
- AI coding agent asks for approval before deleting a database or deploying to production
- n8n workflow pauses for a human to verify a contract or legal document
- Customer support bot escalates to a human when it can't answer a question
- Data labeling pipeline asks a human to classify an ambiguous example
- Any agentic workflow that needs a human checkpoint

---

## Personas

| Persona | Cares about | Challenge | Value we promise |
|---------|-------------|-----------|------------------|
| AI Engineer / Developer | Building reliable, safe agentic systems | Agents take autonomous actions that can't be undone; no structured way to add human checkpoints | Drop-in HITL API that integrates in minutes, works with any agent framework |
| Technical Founder / Entrepreneur | Shipping AI products that work reliably and don't break customer trust | AI agents make mistakes that damage trust; need oversight without slowing down the product | Lightweight oversight layer — agents stay autonomous until they truly need a human |
| DevOps / Platform Engineer | System reliability, security, auditability | Automated pipelines fail silently or take dangerous actions without human awareness | Self-hostable, E2E encrypted, full audit trail of all agent escalations |
| Indie Hacker / Automation Enthusiast | Speed, zero cost, minimal ops overhead | Can't afford complex infrastructure; needs something that "just works" | `npx heysummon` — running in 2 minutes, zero dependencies, SQLite, free forever |

---

## Problems & Pain Points
**Core problem:** AI agents are powerful but imperfect. They get stuck on ambiguous tasks, need approvals before destructive actions, or lack context only a human has. There's no standard, secure, self-hostable way to add a human-in-the-loop checkpoint to an agent workflow.

**Why current alternatives fall short:**
- **Build it yourself** — time-consuming, reinventing the wheel, no encryption, no dashboard
- **Email/Slack hacks** — unstructured, not encrypted, doesn't integrate cleanly with agent polling loops
- **Webhook platforms** — not designed for the request/response pattern agents need; no HITL dashboard
- **No solution** — agents either proceed blindly (risky) or fail completely (bad UX)

**What it costs them:**
- Agents take destructive actions without approval (data loss, security incidents)
- Agents get stuck and fail silently — wasted compute and lost work
- Developers spend time building one-off approval mechanisms instead of shipping product
- Sensitive agent questions get logged in plaintext on third-party systems

**Emotional tension:** Developers and founders want to trust their AI agents but can't — they're anxious about what agents might do unsupervised. HeySummon turns that anxiety into confidence.

---

## Competitive Landscape
**Direct:** No established direct competitor in the "HITL API for AI agents" space — this is an emerging category. HeySummon is defining it.

**Secondary (same problem, different approach):**
- **Roll your own** (custom Slack/webhook integrations) — falls short because it's unstructured, not encrypted, requires ongoing maintenance
- **LangChain/LangGraph human checkpoints** — falls short because it's framework-specific, no dashboard, no encrypted relay

**Indirect (conflicting approach):**
- **Just don't add a human loop** — agents proceed autonomously; falls short when agents hit edge cases or need approval
- **Full human-in-the-loop review tools** (like Scale AI, Labelbox) — designed for data labeling at scale, not real-time agent workflows

---

## Differentiation
**Key differentiators:**
- End-to-end encrypted — the server never reads messages (RSA-OAEP + AES-256-GCM). Unique in this space.
- Self-hostable — full control, data never leaves your infrastructure. Critical for enterprise and privacy-sensitive use cases.
- Works with any AI agent — Claude Code, Codex/OpenClaw, n8n, or any HTTP client
- `npx heysummon` — running in 2 minutes, zero Docker/Git required
- Open source — no vendor lock-in, auditable, community-driven

**How we do it differently:** HeySummon is infrastructure-first — a secure, encrypted relay with a clean HTTP API that any agent can call. It's not tied to one AI framework or platform.

**Why that's better:** Developers can integrate once and use across all their agents and workflows. Privacy is built in, not bolted on. Self-hosting means no subscription required for personal and business use.

**Why customers choose us:** The combination of E2E encryption + self-hostable + works-with-anything + genuinely fast setup doesn't exist anywhere else.

---

## Objections

| Objection | Response |
|-----------|----------|
| "I can just use Slack/email for this" | Slack/email is unstructured, not encrypted, and doesn't integrate into the polling loop agents need. HeySummon is designed specifically for the agent request/response pattern. |
| "I don't want another service to host" | `npx heysummon` runs locally in 2 minutes with zero external dependencies. Or use the managed cloud — free tier available. |
| "My agent framework already has checkpoints" | Framework checkpoints are framework-specific and usually lack a dashboard, encryption, multi-provider routing, and a clean API. HeySummon works alongside any framework. |

**Anti-persona:** Teams that want fully autonomous agents with no human oversight. Users who need a no-code tool (HeySummon requires developer integration).

---

## Switching Dynamics
**Push (what frustrates them about current approach):**
- Agents take risky actions without approval and there's no clean way to stop them
- Building ad-hoc Slack/webhook solutions is fragile and time-consuming
- Sensitive agent questions end up in plaintext logs on third-party systems

**Pull (what attracts them to HeySummon):**
- Drop-in API — integrate in minutes
- E2E encryption out of the box
- Self-hostable — full control
- Open source — auditable, no lock-in

**Habit (what keeps them stuck):**
- "My current Slack integration works well enough"
- Already invested time in a custom webhook solution
- Agents currently work without a HITL layer (haven't hit a painful incident yet)

**Anxiety (what worries them about switching):**
- "Will this add latency to my agent workflows?"
- "What happens if HeySummon goes down — does my agent hang?"
- "Is this production-ready or still experimental?"

---

## Customer Language
**How they describe the problem:**
- "My agent just deleted something it shouldn't have"
- "I need a way for my agent to ask me before doing anything destructive"
- "I want to keep humans in the loop without breaking the agent's flow"
- "There's no good way to add approval steps to agentic workflows"

**How they describe the solution:**
- "A pager for your AI agents"
- "Human-in-the-loop for agents"
- "An approval layer for AI"
- "Like a help desk, but for your AI agent"

**Words to use:** agent, human-in-the-loop, HITL, approval, escalation, encrypted, self-hostable, open source, provider, consumer, real-time, checkpoint

**Words to avoid:** chatbot (HeySummon is infrastructure, not a chatbot), webhook (doesn't capture the HITL concept), monitoring (it's interactive, not passive)

**Glossary:**
| Term | Meaning |
|------|---------|
| Provider | The human expert who answers requests via the dashboard |
| Consumer | The AI agent that sends help requests |
| Client | A registered AI agent/integration (Claude Code, Codex, etc.) |
| Channel | The communication channel for a client (Claude Code, Telegram, etc.) |
| Guard | The reverse proxy that signs and validates all requests |
| HS-XXXX | Reference code assigned to each help request |

---

## Brand Voice
**Tone:** Direct, confident, human. "Hey Summon" is a verb — active, commanding. Not a product name, an instruction.

**Style:** Concise. Code-first. Show don't tell. The name implies simplicity: you say "hey summon JohnDoe" and it works. That same directness runs through all copy.

**Personality:** Self-hosted, platform-agnostic, human-in-the-loop. Independent, trustworthy, open. Feels like infrastructure built by a developer, for developers — not a VC-backed SaaS.

**Logo:** Clean gradient HS mark (orange to blue). Modern, developer-friendly, no mascot.

---

## Proof Points
**Metrics:** [To be added — early access / launch data]

**Customers:** [To be added post-launch]

**Testimonials:** [To be added]

**Value themes:**
| Theme | Proof |
|-------|-------|
| Security | RSA-OAEP + AES-256-GCM E2E encryption; Guard proxy with Ed25519 signing; server never reads messages |
| Speed of setup | `npx heysummon` running in ~2 minutes; no Docker or Git required |
| Flexibility | Works with Claude Code, Codex/OpenClaw, n8n, any HTTP client; self-hostable or cloud |
| Open source | Public GitHub, Sustainable Use License, community contributions welcome |

---

## Goals
**Business goal:** Establish HeySummon as the default HITL infrastructure layer for AI agent developers. Drive adoption through open source, cloud free tier, and developer community.

**Conversion action (launch):** Join the cloud waitlist at cloud.heysummon.ai OR star + self-install from GitHub

**Conversion action (post-launch):** Install HeySummon (`npx heysummon` or Docker)

**Current metrics:** Pre-launch — no audience yet. Targeting launch Friday 2026-03-27. Building through developer communities (Hacker News, GitHub, X/Twitter, AI/agent-focused Discord/Slack channels, Product Hunt).
