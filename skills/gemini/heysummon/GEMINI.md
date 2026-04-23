# HeySummon -- Human in the Loop

HeySummon has two distinct verbs. Pick the one that matches your intent:

- **Use `help()` when:** the agent is stuck, needs approval, or needs human judgment before continuing. The script **blocks** until the expert replies.
- **Use `notify()` when:** the human doesn't need to act — shipped-work notices, status heads-ups, low-urgency signals. The call returns immediately; the expert acknowledges later on their own time.

## Setup

```bash
bash scripts/setup.sh
```

Prompts for your HeySummon base URL and API key, validates the key, and registers the expert.

@./references/architecture.md

## How to ask for help (blocking)

```bash
# Ask a specific expert (recommended)
bash scripts/ask.sh "Your question here" "" "ExpertName"

# Ask without specifying an expert (uses default)
bash scripts/ask.sh "Your question here"

# Ask with context messages
bash scripts/ask.sh "Is this the right approach?" '[{"role":"user","content":"context"}]' "ExpertName"
```

The script **blocks and returns the human's answer** on stdout.

## How to notify (fire-and-forget)

Notifications tell a human that something happened. No reply is expected, and the agent
**does not wait** — it returns the `refCode` immediately and keeps working. The expert
sees a "Notification" card on the dashboard with a single Acknowledge button.

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

## Other commands

```bash
# Add an expert
bash scripts/add-expert.sh "hs_cli_key" "FriendlyName"

# List registered experts
bash scripts/list-experts.sh

# Check request status
bash scripts/check-status.sh <refCode|requestId>
```

## Handling responses

- **Normal response**: The expert's answer is returned on stdout. Use it to continue your work.
- **Expert unavailable**: The request is rejected and you are told when the expert will be available again. You can ask again at that time.
- **`TIMEOUT`**: No response within 15 minutes. The request remains visible on the HeySummon dashboard. You can ask again if needed.

## Rules

- **Always wait** for the response before continuing
- **Be specific** -- include relevant context in your question
- **Don't spam** -- one request at a time; don't ask trivial questions

## Configuration (.env)

```env
HEYSUMMON_BASE_URL=http://localhost:3425
HEYSUMMON_API_KEY=hs_cli_your_key_here
HEYSUMMON_TIMEOUT=900
HEYSUMMON_POLL_INTERVAL=3
```
