---
name: heysummon
description: Ask a human expert for help via HeySummon. Use when you need approval, are stuck, or need human judgment. Triggers on "hey summon <name>" or "heysummon <name> <question>". Sends the question and returns the response.
argument-hint: "<name> <question>"
allowed-tools: "Bash(bash *scripts/*.sh*), Bash(node *scripts/*.js*), Read, Grep"
license: SEE LICENSE IN LICENSE.md
---

# HeySummon — Human in the Loop

When you need human input, approval, or are stuck on something that requires human judgment — use HeySummon to ask a human expert and **wait for their response** before continuing.

## Setup

```bash
bash $SKILL_DIR/scripts/setup.sh
```

This prompts for your HeySummon base URL and API key, validates the key, registers the provider, and starts the background watcher.

## How to ask

```bash
# Ask a specific provider (recommended)
bash $SKILL_DIR/scripts/ask.sh "Your question here" "" "ProviderName"

# Ask without specifying a provider (uses default)
bash $SKILL_DIR/scripts/ask.sh "Your question here"

# Ask with context messages
bash $SKILL_DIR/scripts/ask.sh "Is this the right approach?" '[{"role":"user","content":"context"}]' "ProviderName"
```

The script **blocks and returns the human's answer** on stdout. If the timeout is reached, the background watcher will still capture the response.

### Async mode (non-blocking)

```bash
# Submit and return immediately
bash $SKILL_DIR/scripts/ask.sh --async "Your question here" "" "ProviderName"

# Check for responses later
bash $SKILL_DIR/scripts/ask.sh --check
```

## Other commands

```bash
# Add a provider
bash $SKILL_DIR/scripts/add-provider.sh "hs_cli_key" "FriendlyName"

# List registered providers
bash $SKILL_DIR/scripts/list-providers.sh

# Check request status
bash $SKILL_DIR/scripts/check-status.sh <refCode|requestId>

# Watcher management (PM2)
bash $SKILL_DIR/scripts/setup-watcher.sh start
bash $SKILL_DIR/scripts/setup-watcher.sh stop
bash $SKILL_DIR/scripts/setup-watcher.sh status
```

## Handling responses

- **Normal response**: The provider's answer is returned on stdout. Use it to continue your work.
- **`PROVIDER_UNAVAILABLE`**: The provider is not available right now. Continue with your best judgment or pause.
- **`TIMEOUT`**: No response within 15 minutes. The watcher will capture it later — check with `ask.sh --check`.

## Rules

- **Always wait** for the response before continuing (in blocking mode)
- **Be specific** — include relevant context in your question
- **Don't spam** — one request at a time; don't ask trivial questions

## Configuration (.env)

```env
HEYSUMMON_BASE_URL=http://localhost:3425
HEYSUMMON_API_KEY=hs_cli_your_key_here
HEYSUMMON_TIMEOUT=900
HEYSUMMON_POLL_INTERVAL=3
```
