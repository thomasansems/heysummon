---
name: heysummon
description: Ask a human expert for help via HeySummon. Use when you need approval, are stuck, or need human judgment. Triggers on "hey summon <name>" or "heysummon <name> <question>". Sends the question and returns the response.
argument-hint: "<name> <question>"
license: SEE LICENSE IN LICENSE.md
---

# HeySummon -- Human in the Loop (Gemini CLI)

See `GEMINI.md` for Gemini CLI native instructions with `@./` includes.

For setup and usage, run:

```bash
bash $SKILL_DIR/scripts/setup.sh
```

Prompts for your HeySummon base URL and API key, validates the key, and registers the expert.

## Quick reference

```bash
# Ask a specific expert
bash $SKILL_DIR/scripts/ask.sh "Your question here" "" "ExpertName"
```
