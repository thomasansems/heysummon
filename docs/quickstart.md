# Quickstart

Get HeySummon running and send your first help request in under 5 minutes.

---

## Option 1: NPX (fastest, recommended for testing or with tailscale/cloudflared)

```bash
npx @heysummon/app
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

## Option 2: Docker (recommended for VPS)

One command — downloads compose file, generates secrets, starts everything:

```bash
curl -fsSL https://raw.githubusercontent.com/thomasansems/heysummon/main/install.sh | bash
```

---

## Option 3: Local development

```bash
git clone https://github.com/thomasansems/heysummon.git
cd heysummon
pnpm install
cp .env.example .env.local
pnpm exec prisma migrate dev
pnpm run dev
```

> **Docker-based dev (builds from source):**
> ```bash
> git clone https://github.com/thomasansems/heysummon.git && cd heysummon
> cp .env.example .env
> docker compose -f docker-compose.dev.yml up -d
> ```

---

## 4. Open the dashboard and sign up

Once HeySummon is running, open the dashboard in your browser:

| Install method | Default URL |
|----------------|-------------|
| NPX (`npx @heysummon/app`) | `http://localhost:3435` |
| Docker (`install.sh`) | `http://localhost:3445` |
| Local dev (`pnpm dev`) | `http://localhost:3425` |
| Caddy + custom domain | `https://your-domain.com` |

The **first user to sign up becomes the admin**. After that, registration is closed by default — set `ALLOW_REGISTRATION=true` in your `.env` if you want to invite more people later.

| Scenario | Behavior |
|----------|----------|
| First visit (0 users) | Signup screen, first user becomes **admin** |
| After first user | Signup hidden, registration blocked |
| `ALLOW_REGISTRATION=true` | Anyone can register (multi-user mode) |

---

## 5. Complete the onboarding flow

After signing up you'll be taken through a 6-step onboarding wizard. The whole thing takes about two minutes and sets up everything you need to receive your first help request.

| Step | What happens |
|------|--------------|
| **1. Expert** | Create your expert profile — your name, expertise, and notification preferences |
| **2. Network** | Pick how you want to be notified — Dashboard only, Telegram, or Slack |
| **3. Test** | Send yourself a test notification to confirm the channel works |
| **4. Client** | Create your first client (the AI agent that will summon you) and pick a platform: Claude Code, Codex, Gemini, OpenClaw, or Custom |
| **5. E2E** | Watch a live end-to-end test: a request flows from a simulated agent to you and back, fully encrypted |
| **6. Done** | You're ready — you'll get a setup link to give to your AI client |

At the end of the wizard you'll see a **setup link** for your client. This is a JWT-signed URL that expires in 10 minutes and contains everything your AI agent needs to connect.

---

## 6. Connect your AI agent

Paste the setup link from step 5 into your AI client's session. The client follows its own setup flow:

- **[Claude Code](https://docs.heysummon.ai/clients/claude-code)** — installs the HeySummon skill and registers you as the expert
- **[Codex CLI](https://docs.heysummon.ai/clients/codex)** — same flow, OpenAI-side
- **[Gemini CLI](https://docs.heysummon.ai/clients/gemini)** — same flow, Google-side
- **[OpenClaw](https://docs.heysummon.ai/clients/openclaw)** — same flow, with the OpenClaw runtime
- **Other / HTTP** — see the [Consumer SDK](https://docs.heysummon.ai/consumer/sdk) for direct API integration

Once installed, the agent uses HeySummon naturally:

> `hey summon <expert> <question>`

The agent pauses, you receive the request in the dashboard (and on your chosen notification channel), respond, and the agent picks up your answer and continues its workflow.

---

## Next steps

- [Self-Hosting](https://docs.heysummon.ai/self-hosting/overview) — Production deployment options including Caddy + automatic HTTPS
- [Expert Dashboard](https://docs.heysummon.ai/expert/dashboard) — Tour of the dashboard features
- [Client Integrations](https://docs.heysummon.ai/clients/) — Setup guides for every supported AI agent
- [Security](https://docs.heysummon.ai/security/) — How E2E encryption, signing, and content safety work
