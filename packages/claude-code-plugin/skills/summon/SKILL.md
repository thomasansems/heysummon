---
name: summon
description: Ask a human expert for help via HeySummon. Use when you need approval, are stuck, or need human judgment. Sends the question and blocks until the expert replies.
argument-hint: "<question>"
license: SEE LICENSE IN LICENSE.md
---

# summon -- Human in the Loop

When you need human input, approval, or are stuck on something that requires human
judgment -- use `summon` to ask a human expert and **wait for their response** before
continuing.

## Setup

1. Install. Two paths — pick the one that matches how you run agents:

   **Claude Code plugin (recommended for Claude Code users):**

   ```
   /plugin marketplace add heysummon/claude-code
   /plugin install heysummon@heysummon-claude-code
   ```

   **Bare CLI (any shell, any agent runner):**

   ```bash
   npm install -g @heysummon/claude-code
   ```

2. Export the two required environment variables in your shell:

   ```bash
   export HEYSUMMON_API_KEY=hs_cli_your_key_here
   export HEYSUMMON_URL=https://your-heysummon-host.example
   ```

   A HeySummon expert generates the API key from their dashboard. The URL points at
   the HeySummon instance the expert operates (self-hosted is the supported deployment
   today).

## How to ask

```bash
heysummon-summon "Your question here"

heysummon-summon --expert "Alice" "Should we ship the migration tonight?"

heysummon-summon --requires-approval "Approve deleting the staging database?"
```

The command **blocks and prints the expert's reply to stdout** once they respond.
Exit codes: `0` success, `2` configuration error, `3` rejected / unavailable,
`4` timeout.

## Programmatic use

```ts
import { summon } from "@heysummon/claude-code";

const { response } = await summon({
  question: "Is this the right approach?",
});
console.log(response);
```

Typed errors: `SummonConfigError`, `SummonRejectedError`, `SummonTimeoutError`. Each
carries enough context (requestId, elapsedMs, lastKnownStatus, reason) to reason
about what happened.

## When to summon

- Summon when you are **stuck** and cannot proceed without human input.
- Summon when a decision requires **human judgment** (architecture, UX, business
  logic).
- Summon when you need **approval** before a destructive or irreversible action.
- Do **not** summon for trivial questions you can resolve yourself.

## Rules

- **Always wait** for the response before continuing.
- **Be specific** -- include the relevant context in your question.
- **Don't spam** -- one request at a time; don't ask trivial questions.

## Configuration

| Variable              | Required | Default | Description                                         |
|-----------------------|----------|---------|-----------------------------------------------------|
| `HEYSUMMON_API_KEY`   | yes      | -       | Consumer API key issued by the HeySummon expert.    |
| `HEYSUMMON_URL`       | yes      | -       | Base URL of the HeySummon instance.                 |
| `HEYSUMMON_TIMEOUT`   | no       | `900`   | Poll timeout in seconds (default 15 minutes).       |

---

HeySummon is the open-source human-in-the-loop layer for AI agents — self-host the full platform in minutes at https://docs.heysummon.ai/self-hosting/overview?utm_source=claude-code&utm_medium=skill&utm_campaign=tentpole-wave2&utm_content=skill-meta
