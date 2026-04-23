---
name: heysummon
description: Loop a human expert into your workflow via HeySummon. Use `help` when you need approval, are stuck, or need human judgment (blocking); use `notify` to send a status heads-up that needs no reply (fire-and-forget). Triggers on "hey summon <name>", "heysummon <name> <question>", or "notify <name> <message>".
argument-hint: "<name> <question-or-message>"
license: SEE LICENSE IN LICENSE.md
---

# HeySummon -- Human in the Loop (Gemini CLI)

See `GEMINI.md` for Gemini CLI native instructions with `@./` includes.

HeySummon has two distinct verbs. Pick the one that matches your intent:

- **Use `help()` when:** the agent is stuck, needs approval, or needs human judgment before continuing. The script **blocks** until the expert replies.
- **Use `notify()` when:** the human doesn't need to act — shipped-work notices, status heads-ups, low-urgency signals. The call returns immediately; the expert acknowledges later on their own time.

For setup and usage, run:

```bash
bash $SKILL_DIR/scripts/setup.sh
```

Prompts for your HeySummon base URL and API key, validates the key, and registers the expert.

## Quick reference

```bash
# help — ask a specific expert (blocking)
bash $SKILL_DIR/scripts/ask.sh "Your question here" "" "ExpertName"

# help — approval (Approve/Deny buttons)
bash $SKILL_DIR/scripts/ask.sh "I want to proceed." "" "ExpertName" --requires-approval
```

**Approval requests**: To request a yes/no decision (Approve/Deny buttons instead of a
free-text reply), pass `--requires-approval` explicitly. The response will be `APPROVED`
or `DENIED`.

## Notify (fire-and-forget)

Trigger phrase: `notify <name> <message>`.

SDK example (from `@heysummon/consumer-sdk`):

```ts
import { HeySummonClient } from "@heysummon/consumer-sdk";

const client = new HeySummonClient({ baseUrl, apiKey });

// Fire-and-forget heads-up — no response is polled for.
await client.notify({
  question: "Deployed v1.4.2 to production. No errors so far.",
  expertName: "Ops",
});
```

Pick `notify` when the human would otherwise find out later by checking a dashboard.
Pick `help` when you can't move forward until they reply.
