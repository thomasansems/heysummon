# HeySummon -- Human in the Loop

When you need human input, approval, or are stuck on something that requires human judgment -- use HeySummon to ask a human expert and **wait for their response** before continuing.

## Setup

```bash
bash {baseDir}/scripts/setup.sh
```

Prompts for your HeySummon base URL and API key, validates the key, and registers the provider.

## How to ask

```bash
# Ask a specific provider (recommended)
bash {baseDir}/scripts/ask.sh "Your question here" "" "ProviderName"

# Ask without specifying a provider (uses default)
bash {baseDir}/scripts/ask.sh "Your question here"

# Ask with context messages
bash {baseDir}/scripts/ask.sh "Is this the right approach?" '[{"role":"user","content":"context"}]' "ProviderName"
```

The script **blocks and returns the human's answer** on stdout.

## Other commands

```bash
# Add a provider
bash {baseDir}/scripts/add-provider.sh "hs_cli_key" "FriendlyName"

# List registered providers
bash {baseDir}/scripts/list-providers.sh

# Check request status
bash {baseDir}/scripts/check-status.sh <refCode|requestId>
```

## Handling responses

- **Normal response**: The provider's answer is returned on stdout. Use it to continue your work.
- **Provider unavailable**: The request is rejected and you are told when the provider will be available again. You can ask again at that time.
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
