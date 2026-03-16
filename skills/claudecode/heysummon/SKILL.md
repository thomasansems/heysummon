# HeySummon Skill for Claude Code (Polling)

When you (Claude Code) get stuck, need approval, or need human input — use HeySummon to ask a human expert and **wait for their response** before continuing.

This skill uses **polling** (no MCP server required). Claude Code calls a bash script that submits the request and polls until the human responds, then returns the answer inline.

> **Alternative:** If you prefer MCP-native integration, use the `skills/claudecode/mcp-server` instead.

---

## Setup

### Step 1: Install (one command)

```bash
bash skills/claudecode/heysummon/scripts/setup.sh
```

This will prompt for your HeySummon API key and base URL, and write a `.env` file.

### Step 2: Add to Claude Code project

Add to your project's `AGENTS.md` or `CLAUDE.md`:

```markdown
## HeySummon — Human in the Loop

When you need human input, approval, or are stuck on something that requires human judgment, use HeySummon:

```bash
bash /path/to/skills/claudecode/heysummon/scripts/ask.sh "Your question here"
```

Wait for the response before continuing. The script returns the human's answer on stdout.
```

---

## Usage

### Ask a question (inline, blocking)

```bash
bash scripts/claudecode/heysummon/scripts/ask.sh "Should I delete the old migration files?"
```

Claude Code calls this, the human gets notified on Telegram/WhatsApp, responds, and the script returns the answer. Claude Code then continues with that answer.

### Ask with context messages

```bash
bash scripts/ask.sh "Is this the right approach?" '{"role":"user","content":"I was trying to refactor the auth module..."}'
```

### Ask a specific provider

```bash
bash scripts/ask.sh "Review this SQL query" "" "Thomas"
```

---

## How it works

```
Claude Code
    │
    ├─ bash ask.sh "question"
    │       │
    │       ├─ POST /api/v1/help  → HeySummon platform
    │       │                         │
    │       │                     Provider notified (Telegram/WhatsApp)
    │       │                         │
    │       ├─ polls GET /api/v1/events/pending  (every 3s)
    │       │                         │
    │       │                     Human responds
    │       │                         │
    │       └─ returns response to Claude Code stdout
    │
    └─ Claude Code reads response and continues
```

---

## Configuration (.env)

```env
HEYSUMMON_BASE_URL=http://localhost:3425
HEYSUMMON_API_KEY=hs_cli_your_key_here
HEYSUMMON_TIMEOUT=300        # seconds to wait for response (default: 300)
HEYSUMMON_POLL_INTERVAL=3    # poll every N seconds (default: 3)
```

---

## Files

| File | Purpose |
|------|---------|
| `scripts/setup.sh` | Interactive setup — creates .env |
| `scripts/ask.sh` | Submit question + poll for answer (blocking) |
| `scripts/check-status.sh` | Check status of a pending request by refCode |
| `scripts/list-providers.sh` | List available providers |
