---
name: heysummon
description: Ask a human expert for help via HeySummon. Use when you need approval, are stuck, or need human judgment. Triggers on "hey summon <name>" or "heysummon <name> <question>". Sends the question and returns the response.
argument-hint: "<name> <question>"
license: SEE LICENSE IN LICENSE.md
---

# HeySummon -- Human in the Loop (Gemini CLI)

See `GEMINI.md` for Gemini CLI native instructions with `@./` includes.

## Setup (platform-managed / OpenClaw)

```bash
npx clawhub@latest install heysummon
curl -sf "<setup-url>/command" | jq -r '.installCommand' | bash
```

The one-liner sets `HEYSUMMON_BASE_URL` and `HEYSUMMON_SUMMON_CONTEXT` as env-prefix values and calls `add-expert.sh`. Those values are persisted to `$SKILL_DIR/.env` so future `ask.sh` calls in fresh shells pick them up automatically.

## Setup (interactive / manual)

```bash
bash $SKILL_DIR/scripts/setup.sh
```

Prompts for your HeySummon base URL and API key, validates the key, and registers the expert.

## Quick reference

```bash
# Ask a specific expert
bash $SKILL_DIR/scripts/ask.sh "Your question here" "" "ExpertName"

# Ask for approval (expert gets Approve/Deny buttons)
bash $SKILL_DIR/scripts/ask.sh "I want to proceed." "" "ExpertName" --requires-approval

# Identify the expert(s) bound to this skill
bash $SKILL_DIR/scripts/whoami.sh
```

**Approval requests**: To request a yes/no decision (Approve/Deny buttons instead of a
free-text reply), pass `--requires-approval` explicitly. The response will be `APPROVED`
or `DENIED`.
