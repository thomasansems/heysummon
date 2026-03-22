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

### Blocking mode (default — waits up to 15 min)

```bash
# Ask a specific provider (recommended)
bash $SKILL_DIR/scripts/ask.sh "Your question here" "" "ProviderName"

# Ask without specifying a provider (uses default)
bash $SKILL_DIR/scripts/ask.sh "Your question here"

# Ask with context messages
bash $SKILL_DIR/scripts/ask.sh "Is this the right approach?" '[{"role":"user","content":"context here..."}]' "ProviderName"
```

The script **blocks and returns the human's answer** on stdout. If the timeout is reached, the background watcher will still capture the response and deliver it on the next check.

### Async mode (non-blocking — watcher delivers response later)

```bash
# Submit a question and return immediately
bash $SKILL_DIR/scripts/ask.sh --async "Your question here" "" "ProviderName"

# Check for responses later
bash $SKILL_DIR/scripts/ask.sh --check
```

The `--async` flag submits the request and returns immediately. The PM2 watcher (`heysummon-cc-watcher`) polls the platform in the background and writes responses to `inbox/` when they arrive.

## Other commands

```bash
# Add a provider
bash $SKILL_DIR/scripts/add-provider.sh "hs_cli_key" "FriendlyName"

# List registered providers
bash $SKILL_DIR/scripts/list-providers.sh

# Check request status
bash $SKILL_DIR/scripts/check-status.sh <refCode|requestId>

# Watcher management
bash $SKILL_DIR/scripts/setup-watcher.sh start    # start the background watcher
bash $SKILL_DIR/scripts/setup-watcher.sh stop     # stop the watcher
bash $SKILL_DIR/scripts/setup-watcher.sh status   # show status + pending count
bash $SKILL_DIR/scripts/setup-watcher.sh logs     # tail watcher log
```

## Handling responses

- **Normal response**: The provider's answer is returned on stdout. Use it to continue your work.
- **`PROVIDER_UNAVAILABLE`**: The provider is outside their availability window. Note it and continue with your best judgment or pause the task.
- **`TIMEOUT`**: No response was received within 15 minutes. The watcher will continue polling in the background. Check the inbox later with `ask.sh --check`.

## Rules

- **Always wait** for the response before continuing (in blocking mode)
- **Be specific** — include relevant context in your question
- **Don't spam** — one request at a time; don't ask trivial questions

## How it works

```
Claude Code
    |
    +- ask.sh "question" "" "ProviderName"      (BLOCKING)
    |       |
    |       +- SDK CLI submit-and-poll -> HeySummon platform
    |       |       |                         |
    |       |       |                     Provider notified
    |       |       |                         |
    |       |   polls every 3s, up to 15 min  |
    |       |       |                         |
    |       |   Human responds (or timeout)   |
    |       |       |
    |       +- returns response on stdout
    |       +- if timeout: saves to pending/ for watcher
    |
    +- ask.sh --async "question"                (NON-BLOCKING)
    |       |
    |       +- SDK CLI submit -> saves to pending/
    |       +- returns immediately
    |
    +- PM2: heysummon-cc-watcher (background)
    |       |
    |       +- polls pending/*.json every 3s
    |       +- on response: writes to inbox/*.json
    |
    +- ask.sh --check                           (READ INBOX)
            |
            +- reads inbox/*.json
            +- outputs responses, archives files
```

## Configuration (.env)

```env
HEYSUMMON_BASE_URL=http://localhost:3425
HEYSUMMON_API_KEY=hs_cli_your_key_here
HEYSUMMON_TIMEOUT=900        # seconds to wait for response (default: 900 / 15 min)
HEYSUMMON_POLL_INTERVAL=3    # poll every N seconds (default: 3)
```

## Directory structure

```
skills/claudecode/heysummon/
  .env              # API key and config
  pending/          # Active requests awaiting response
  inbox/            # Received responses (read by check-inbox.sh)
    archive/        # Processed responses (history)
  logs/             # Watcher log
  scripts/
    ask.sh          # Main entry point (blocking, --async, --check)
    submit.sh       # Non-blocking submit
    check-inbox.sh  # Read inbox
    watcher.js      # PM2 persistent poller
    setup-watcher.sh # PM2 lifecycle management
    setup.sh        # Initial setup (writes .env, starts watcher)
    add-provider.sh # Register a provider
    list-providers.sh
    check-status.sh
```
