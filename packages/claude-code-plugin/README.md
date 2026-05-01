# @heysummon/claude-code

A Claude Code plugin and TypeScript tool that lets an AI agent **summon a human
expert** when it is stuck, needs approval, or lacks context. The agent submits a
question, the expert answers through the HeySummon dashboard, and the agent
resumes -- with the expert's reply in hand.

- Single tool: `summon`.
- Claude Code plugin (skill-based) + programmatic TypeScript API.
- End-to-end encryption on by default via `@heysummon/consumer-sdk`.
- Typed errors (`SummonConfigError`, `SummonRejectedError`, `SummonTimeoutError`).
- Works against any self-hosted HeySummon instance.

## Install

```bash
npm install @heysummon/claude-code
```

The package ships with a `heysummon-summon` bin entry for shell use and a library
entry for programmatic use.

## 5-minute quickstart

1. Ask a HeySummon expert to issue you a consumer API key from their dashboard.

2. Export the two required environment variables:

   ```bash
   export HEYSUMMON_API_KEY=hs_cli_your_key_here
   export HEYSUMMON_URL=https://your-heysummon-host.example
   ```

3. From the command line:

   ```bash
   heysummon-summon "Should I proceed with the database migration?"
   ```

4. The expert sees the request in their HeySummon dashboard and replies.

5. The CLI unblocks and prints the expert's answer to stdout. Your agent continues.

That is the entire loop.

## Programmatic use

```ts
import { summon } from "@heysummon/claude-code";

const { response, requestId, elapsedMs } = await summon({
  question: "Is this architecture acceptable for v1?",
});

console.log(response);
```

Approval-style requests (Approve / Deny buttons for the expert) work the same way:

```ts
const { response } = await summon({
  question: "Approve deleting the staging database?",
  requiresApproval: true,
});
// response will be "approved" or "denied"
```

## Environment

| Variable              | Required | Default | Description                                      |
|-----------------------|----------|---------|--------------------------------------------------|
| `HEYSUMMON_API_KEY`   | yes      | -       | Consumer API key issued by the HeySummon expert. |
| `HEYSUMMON_URL`       | yes      | -       | Base URL of the HeySummon instance.              |
| `HEYSUMMON_TIMEOUT`   | no       | `900`   | Poll timeout in seconds (default 15 minutes).    |

If either of the required vars is missing, `summon` throws `SummonConfigError`
before making any network call.

## Error handling

```ts
import {
  summon,
  SummonConfigError,
  SummonRejectedError,
  SummonTimeoutError,
} from "@heysummon/claude-code";

try {
  const { response } = await summon({ question: "Ship it?" });
  return response;
} catch (err) {
  if (err instanceof SummonConfigError) {
    // HEYSUMMON_API_KEY / HEYSUMMON_URL missing or invalid
  } else if (err instanceof SummonRejectedError) {
    // No expert available, or the request was cancelled / expired
    // err.status, err.reason, err.requestId
  } else if (err instanceof SummonTimeoutError) {
    // Poll exceeded HEYSUMMON_TIMEOUT without a terminal status
    // err.requestId, err.elapsedMs, err.lastKnownStatus
  } else {
    throw err;
  }
}
```

The CLI exits `0` on success, `2` on configuration error, `3` when rejected or no
expert is available, and `4` on timeout.

## Installing as a Claude Code plugin

From inside Claude Code, run:

```
/plugin marketplace add heysummon/claude-code
/plugin install heysummon@heysummon-claude-code
```

The first line registers this repo as a plugin marketplace; the second installs the
`heysummon` plugin from it. The `summon` skill is then available to the agent in that
session.

The skill lives at `./skills/summon/SKILL.md` and calls the `heysummon-summon` CLI
under the hood. The `.claude-plugin/marketplace.json` + `.claude-plugin/plugin.json`
pair drive the marketplace registration above.

## Polling contract

- Default exponential backoff: **2s -> 4s -> 8s -> 15s max**, starting on the first
  poll.
- Terminal statuses: `closed`, `responded`, `timed_out`, `cancelled`, `expired`.
  `summon` stops polling on any terminal status and either returns the expert
  response (`closed` / `responded`) or raises a typed error.
- In the default E2E mode, the dashboard flips status to `responded` and writes
  the encrypted reply to the messages table; `summon` fetches and decrypts it via
  the SDK before returning, so callers always receive the expert plaintext.
- On timeout, `summon` calls `reportTimeout()` on the server before throwing
  `SummonTimeoutError`, so the server can release the slot immediately.
- Server Sent Events are not used in v0.1; the simple poll is deliberate. SSE is
  on the roadmap for v0.2.

## Troubleshooting

- **Expert reply never arrives despite the dashboard showing it.** Older HeySummon
  instances require the expert to complete a one-time key-exchange step before
  encrypted responses can be accepted. Ask the expert to open the request in the
  dashboard at least once to seed `expertSignPubKey` / `expertEncryptPubKey`.
  Requests submitted before that handshake will sit until the expert's browser
  registers the keys.

## Development

```bash
npm install
npm test
npm run build
npm run lint
```

## License

Sustainable Use License. See [LICENSE.md](./LICENSE.md).

---

HeySummon is the open-source human-in-the-loop layer for AI agents — self-host the full platform in minutes at https://docs.heysummon.ai/self-hosting/overview?utm_source=claude-code&utm_medium=readme&utm_campaign=tentpole-wave2&utm_content=readme-footer
