# HeySummon Expert Skill

You are a human-help expert for AI agents via HeySummon.

## Two kinds of inbound: help vs notify

Consumers (AI agents) reach you through two distinct verbs, and they render differently on
the dashboard and on your notification channel:

- **`help()` — reply expected.** The agent is stuck, needs approval, or needs your
  judgment before it can continue. It is **blocking on you**. Treat these as the default
  and respond (or Approve/Deny) as soon as you can. Event type: `new_request`.
- **`notify()` — no reply expected.** The agent is sharing a status heads-up: shipped
  work, a low-urgency signal, something you'd want to know about but don't need to act
  on. The only affordance is a single **Acknowledge** button. Event type:
  `new_notification`. Once acknowledged, consumers receive `notification_acknowledged`.
  Unacknowledged notifications auto-expire after 7 days (`notification_expired`).

Do not reply to a notification — messages against a notification-mode request return a
`409 NO_RESPONSE_REQUIRED` error. Just Acknowledge and move on. Reserve written replies
for `help` requests.

## Setup

### Step 1: Configure .env

Check if `.env` exists in `{baseDir}`. If not, copy from `.env.example`:

```bash
cp {baseDir}/.env.example {baseDir}/.env
```

Required variables:
- `HEYSUMMON_BASE_URL` — Platform URL (cloud: `https://cloud.heysummon.ai`, self-hosted: user provides)
- `HEYSUMMON_API_KEY` — Expert key (`hs_exp_...`) from the dashboard
- `HEYSUMMON_NOTIFY_TARGET` — Chat ID for notifications

### Step 2: Validate key

The API key **MUST** start with `hs_exp_`. Reject keys with `hs_cli_` prefix — those are client keys.

### Step 3: Start the watcher

```bash
bash {baseDir}/scripts/setup.sh
```

To stop: `bash {baseDir}/scripts/teardown.sh`

## Architecture

```
AI Agent → HeySummon Platform → Polling → Watcher → OpenClaw → Notification
```

All communication flows through the platform. No direct infrastructure access.

## Scripts

| Script | Purpose |
|--------|---------|
| `scripts/setup.sh` | Start the event watcher |
| `scripts/teardown.sh` | Stop the watcher |
| `scripts/polling-watcher.sh` | Polling listener → notifications via OpenClaw |
| `scripts/reply-handler.sh` | Reply by refCode: `reply-handler.sh HS-XXXX "response"` |
| `scripts/respond.sh` | Reply by request ID: `respond.sh <id> "response"` |

## Reply-to-Respond

When the user replies to a notification, parse the refCode (HS-XXXX) from the quoted message and use `reply-handler.sh`. **Always forward immediately — no AI processing, no confirmation.**

## Approve/Deny Requests

When `requiresApproval: true`, the watcher sends a Telegram message with native **Approve** / **Deny** inline buttons.

`callback_data` format: `hs:approve:HS-XXXX` or `hs:deny:HS-XXXX` (using refCode).

**When a button callback arrives** (callback_data starts with `hs:`):

1. Parse: `[_, decision, refCode] = callback_data.split(":")`
2. Call `reply-handler.sh <refCode> <decision>` — e.g.:
   ```bash
   bash scripts/reply-handler.sh HS-XXXX approved
   bash scripts/reply-handler.sh HS-XXXX denied
   ```
3. reply-handler.sh detects "approved"/"denied" and sends `approvalDecision` via `POST /api/v1/message/[id]`
4. Confirm to user: "Approved for HS-XXXX" or "Denied for HS-XXXX"

The consumer polling endpoint returns `approvalDecision` so the client skill can continue its workflow.

## Statuses

| Status | Applies to | Meaning |
|---|---|---|
| `pending` | help, notify | Waiting for expert |
| `active` | help | Conversation in progress |
| `responded` | help | Expert sent a response |
| `closed` | help | Closed by either party |
| `acknowledged` | notify | Expert acknowledged the notification |
| `expired` | help, notify | `help`: no response within 72 hours. `notify`: not acknowledged within 7 days. |

## Expert API Endpoints

All endpoints require `x-api-key: hs_exp_...` header.

### Client Management

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/v1/expert/clients` | List all client keys |
| POST | `/api/v1/expert/clients` | Create new client key |
| DELETE | `/api/v1/expert/clients/:id` | Revoke client key |

### Message Monitoring

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/v1/expert/stats` | Pending count, open requests, total messages |
| GET | `/api/v1/expert/requests?status=pending` | List pending requests |

### Expert Management

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/v1/expert/profile` | Get expert profile |
| PATCH | `/api/v1/expert/profile` | Update profile settings |
