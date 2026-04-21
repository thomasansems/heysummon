# HeySummon -- Human in the Loop

When you need human input, approval, or are stuck on something that requires human judgment -- use HeySummon to ask a human expert and **wait for their response** before continuing.

## Setup (platform-managed / OpenClaw)

Paste the two-step install emitted by the HeySummon dashboard:

```bash
npx clawhub@latest install heysummon
curl -sf "<setup-url>/command" | jq -r '.installCommand' | bash
```

The second line reads a non-interactive one-liner from the dashboard, sets `HEYSUMMON_BASE_URL` and `HEYSUMMON_SUMMON_CONTEXT` as env-prefix values, and calls `add-expert.sh` with the API key. Those values are persisted to `{baseDir}/.env` so future `ask.sh` calls in fresh shells pick them up automatically.

## Setup (interactive / manual)

```bash
bash {baseDir}/scripts/setup.sh
```

Prompts for your HeySummon base URL and API key, validates the key, and registers the expert.

## How to ask

```bash
# Ask a specific expert (recommended)
bash {baseDir}/scripts/ask.sh "Your question here" "" "ExpertName"

# Ask without specifying an expert (uses default)
bash {baseDir}/scripts/ask.sh "Your question here"

# Ask with context messages
bash {baseDir}/scripts/ask.sh "Is this the right approach?" '[{"role":"user","content":"context"}]' "ExpertName"
```

The script **blocks and returns the human's answer** on stdout.

## Other commands

```bash
# Add an expert
bash {baseDir}/scripts/add-expert.sh "hs_cli_key" "FriendlyName"

# List registered experts
bash {baseDir}/scripts/list-experts.sh

# Identify the expert(s) bound to this skill (base URL, key, owner, active)
bash {baseDir}/scripts/whoami.sh

# Check request status
bash {baseDir}/scripts/check-status.sh <refCode|requestId>
```

## Handling responses

- **Normal response**: The expert's answer is returned on stdout. Use it to continue your work.
- **Expert unavailable**: The request is rejected and you are told when the expert will be available again. You can ask again at that time.
- **`TIMEOUT`**: No response within 15 minutes. The request remains visible on the HeySummon dashboard. You can ask again if needed.

## When to summon

If `HEYSUMMON_SUMMON_CONTEXT` is set in your environment, follow those guidelines to decide when to summon the expert. The expert wrote these instructions specifically for you.

If no summoning context is configured, use these defaults:
- Summon when you are **stuck** and cannot proceed without human input
- Summon when a decision requires **human judgment** (architecture, UX, business logic)
- Summon when you need **approval** before a destructive or irreversible action
- Do **not** summon for trivial questions you can resolve yourself

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
HEYSUMMON_SUMMON_CONTEXT=Only summon when stuck or need approval
```
