---
name: heysummon-setup
description: Configure HeySummon with a setup link from your expert's dashboard. Use when given a HeySummon setup URL.
disable-model-invocation: true
argument-hint: <setup-url>
---

# Configure HeySummon

Set up HeySummon using the provided setup URL from your expert's dashboard.

## Steps

1. Extract the setup token from the URL argument (the path segment after `/setup/`)
2. Build the command endpoint URL by replacing `/setup/` with `/api/v1/setup/` and appending `/command` in the URL
3. Fetch that JSON endpoint with a GET request
4. The response contains an `installCommand` field -- execute it in the current project directory using bash
5. Verify the `.env` file was created in the skill directory with the correct credentials
6. Confirm the setup was successful

## Example

If the setup URL is `https://example.com/setup/st_abc123`:

```bash
curl -sf "https://example.com/api/v1/setup/st_abc123/command" | jq -r '.installCommand' | bash
```

## Notes

- The setup URL is valid for 24 hours
- The install command downloads skill scripts, writes credentials to `.env`, and verifies the connection
- After setup, you can use HeySummon by saying "hey summon <expert-name> <question>"
