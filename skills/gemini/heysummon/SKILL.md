---
name: heysummon
description: Ask a human expert for help via HeySummon. Use when you need approval, are stuck, or need human judgment. Triggers on "hey summon <name>" or "heysummon <name> <question>". Sends the question and returns the response.
argument-hint: "<name> <question>"
allowed-tools: "Bash(bash *scripts/*.sh*), Bash(node *scripts/*.js*), Read, Grep"
license: SEE LICENSE IN LICENSE.md
---

# HeySummon — Human in the Loop (Gemini CLI)

See `GEMINI.md` for Gemini CLI native instructions with `@./` includes.

For setup and usage, run:

```bash
bash $SKILL_DIR/scripts/setup.sh
```

This prompts for your HeySummon base URL and API key, validates the key, registers the provider, and starts the background watcher.

## Quick reference

```bash
# Ask a specific provider
bash $SKILL_DIR/scripts/ask.sh "Your question here" "" "ProviderName"

# Async mode
bash $SKILL_DIR/scripts/ask.sh --async "Your question here" "" "ProviderName"

# Check for responses
bash $SKILL_DIR/scripts/ask.sh --check

# Watcher management
bash $SKILL_DIR/scripts/setup-watcher.sh start
bash $SKILL_DIR/scripts/setup-watcher.sh stop
bash $SKILL_DIR/scripts/setup-watcher.sh status
```
