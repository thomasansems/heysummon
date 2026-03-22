---
name: heysummon
description: Ask a human expert for help. Use when you need approval, are stuck, or need human judgment. Triggers on "hey summon <name>" or "heysummon <name>" or "heysummon <name> <question>". Sends the question via HeySummon and waits for the response.
argument-hint: "<name> <question>"
---

# HeySummon — Human in the Loop

When you need human input, approval, or are stuck on something that requires human judgment — use HeySummon to ask a human expert and **wait for their response** before continuing.

## Trigger phrases

The user can invoke this skill with natural language:

- "hey summon Thomas should I delete the old migrations?"
- "heySummon Thomas is this the right approach for the caching layer?"
- "hey summon Thomas" (you'll be prompted for a question)

When you see these phrases, extract the **provider name** and **question**, then run the script below.

## How to ask

```bash
# Ask a specific provider (recommended)
bash $SKILL_DIR/scripts/ask.sh "Your question here" "" "ProviderName"

# Ask without specifying a provider (uses default)
bash $SKILL_DIR/scripts/ask.sh "Your question here"

# Ask with context messages
bash $SKILL_DIR/scripts/ask.sh "Is this the right approach?" '[{"role":"user","content":"context here..."}]' "ProviderName"
```

The script **blocks and returns the human's answer** on stdout. Read the response and continue accordingly.

## Other commands

```bash
# Add a provider
bash $SKILL_DIR/scripts/add-provider.sh "hs_cli_key" "FriendlyName"

# List registered providers
bash $SKILL_DIR/scripts/list-providers.sh

# Check request status
bash $SKILL_DIR/scripts/check-status.sh <refCode|requestId>
```

## Handling responses

- **Normal response**: The provider's answer is returned on stdout. Use it to continue your work.
- **`PROVIDER_UNAVAILABLE`**: The provider is outside their availability window. Note it and continue with your best judgment or pause the task.
- **`TIMEOUT`**: No response was received within 15 minutes. The provider may still respond later. Inform the user that the request is pending and continue with other work or pause the task.

## Rules

- **Always wait** for the response before continuing
- **Be specific** — include relevant context in your question
- **Don't spam** — one request at a time; don't ask trivial questions

## How it works

```
Claude Code
    |
    +- bash ask.sh "question" "" "ProviderName"
    |       |
    |       +- SDK CLI submit-and-poll  -> HeySummon platform
    |       |                               |
    |       |                           Provider notified (Telegram/WhatsApp)
    |       |                               |
    |       +- polls GET /api/v1/help/:id  (every 3s, up to 15 min)
    |       |                               |
    |       |                           Human responds
    |       |                               |
    |       +- returns response to Claude Code stdout
    |
    +- Claude Code reads response and continues
```

## Configuration (.env)

```env
HEYSUMMON_BASE_URL=http://localhost:3425
HEYSUMMON_API_KEY=hs_cli_your_key_here
HEYSUMMON_TIMEOUT=900        # seconds to wait for response (default: 900 / 15 min)
HEYSUMMON_POLL_INTERVAL=3    # poll every N seconds (default: 3)
```
