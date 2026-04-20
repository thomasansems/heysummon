# n8n-nodes-heysummon

[![n8n.io - Workflow Automation](https://img.shields.io/badge/n8n.io-community-FF6D5A.svg)](https://n8n.io)

`n8n-nodes-heysummon` is the community node for [HeySummon](https://heysummon.ai) — the open-source human-in-the-loop platform for AI agents. Drop a HeySummon node into any n8n workflow to pause execution, summon a human expert, and resume on the answer.

This package is **MIT licensed** so it qualifies for n8n's Verified Community Nodes program. The rest of the HeySummon repo remains under the Sustainable Use License.

## Installation (self-hosted n8n)

In your n8n instance:

1. Go to **Settings → Community Nodes**.
2. Click **Install** and enter `n8n-nodes-heysummon`.
3. Restart n8n if prompted.

Or install manually inside your n8n container:

```bash
npm install n8n-nodes-heysummon
```

## Configure the credential

Create a new credential of type **HeySummon API**:

| Field | Value |
| --- | --- |
| API Key | `hs_cli_…` from your HeySummon dashboard |
| Base URL | The URL of your self-hosted HeySummon instance (e.g. `https://heysummon.example.com`) |
| End-to-End Encryption | On by default. Leave on for the security default. |

Click **Test** — n8n will hit `GET /api/v1/health` on your instance. A green tick means you're ready.

## Operations

### Summon

Blocks the workflow and waits for a human expert to answer.

| Parameter | Required | Default | Description |
| --- | --- | --- | --- |
| Question | yes | — | Plaintext question for the expert. |
| Context | no | — | Optional background sent as the first message. |
| Expert Name | no | — | Route to a specific expert. |
| Requires Approval | no | `false` | Surface an Approve/Deny prompt. |
| Summoning Guidelines | no | — | Per-call override of the `HEYSUMMON_SUMMON_CONTEXT` rules. |
| Timeout (ms) | yes | `900000` | Local timeout (default 15 min). |
| Poll Interval (ms) | yes | `2000` | How often to poll for the answer. |

Returns:

```json
{
  "requestId": "cm…",
  "refCode": "HS-A1B2C3D4",
  "status": "responded",
  "response": "Plaintext answer (decrypted in process when E2E is on).",
  "responder": "expert-name-or-null",
  "respondedAt": "2026-04-20T18:30:00.000Z",
  "latencyMs": 87412,
  "messageCount": 3
}
```

### Get Status

Single non-blocking poll for an existing request.

| Parameter | Required | Default | Description |
| --- | --- | --- | --- |
| Request ID | yes | — | The `requestId` returned by a previous Summon call. |

When E2E is on (the default), `response` is always `null` — the per-execution decryption keypair from the original Summon is no longer in memory. To get the decrypted response across executions, disable E2E on the credential.

## Errors

Both operations return a structured error envelope on failure:

```json
{
  "error": {
    "kind": "timeout | expired | network | http | guard_rejected | validation",
    "message": "Human readable explanation",
    "requestId": "cm… or null",
    "refCode": "HS-… or null",
    "httpStatus": 504,
    "retriable": false
  }
}
```

When **Continue On Fail** is enabled on the node, errors are emitted on the second output port instead of throwing.

## User-Agent attribution

Every outbound call from this node sets:

```
User-Agent: n8n-nodes-heysummon/<package-version> (n8n; node)
```

The version is read from this package's `package.json` at runtime. HeySummon uses this signal to attribute n8n install volume — please leave the User-Agent intact.

## Self-hosted only

HeySummon is currently self-hosted only. The Base URL on the credential must point at your own instance — there is no managed cloud endpoint to leave the field blank for.

## Documentation

Full documentation: [docs.heysummon.ai/integrations/orchestrators/n8n](https://docs.heysummon.ai/integrations/orchestrators/n8n).

## License

MIT — see [LICENSE](./LICENSE).
