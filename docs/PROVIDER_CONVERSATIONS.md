# 💬 Having Conversations with AI Agents

As a **provider** (human expert), HeySummon makes it easy to respond to AI agent requests directly from your favorite messaging app — no need to open a dashboard.

This guide explains how the **reply-to-respond** flow works.

---

## How It Works

When an AI agent sends a help request, you receive a notification in your configured channel (e.g. Telegram, Signal, WhatsApp) that looks like this:

```
🦞 HeySummon [HS-A1B2C3D4] New request
📝 What is the capital of France?
```

The `[HS-XXXXXXXX]` tag is the **reference code** for that request. It uniquely identifies the conversation thread between you and the agent.

---

## Responding to a Request

### Option 1: Reply in your messaging app (recommended)

Simply **reply to the notification message** and include the ref code tag anywhere in your message:

```
[HS-A1B2C3D4] Paris
```

Your AI assistant (e.g. OpenClaw / Octo) will automatically detect the ref code, and forward your response back to the waiting agent.

> **Tip:** On Telegram, you can use the native "Reply" feature on the notification message — your assistant will parse the ref code from the quoted message automatically, even without typing it manually.

```
┌─────────────────────────────────────┐
│ 🦞 HeySummon [HS-A1B2C3D4]         │
│ 📝 What is the capital of France?  │
└─────────────────────────────────────┘
  ↳ You reply: "Paris"
        │
        ▼
  ✅ Response sent to agent
```

### Option 2: Include the ref code in a new message

If you're not replying directly, just include the ref code tag in a new message:

```
[HS-A1B2C3D4] The answer is Paris, population ~2.1M
```

You can write as much as you want after the tag — the full message is forwarded to the agent.

---

## Multi-turn Conversations

HeySummon supports back-and-forth conversations. After you respond, the agent may follow up with another request — you'll receive a new notification with the **same ref code**:

```
🦞 HeySummon [HS-A1B2C3D4] Follow-up
📝 And what is the population of Paris?
```

Respond the same way:

```
[HS-A1B2C3D4] About 2.1 million in the city proper
```

Each message in a conversation shares the same ref code, making threads easy to track.

---

## Full Example Flow

```
[Agent]                    [HeySummon]              [You, via Telegram]

  │── help request ──────────▶│
  │   "What's the deadline    │── notification ──────▶ 🦞 [HS-7X3K9Q2M]
  │    for project Alpha?"    │                         📝 What's the deadline
  │                           │                            for project Alpha?
  │                           │
  │                           │◀── your reply ───────── [HS-7X3K9Q2M] March 15th
  │◀── response ──────────────│
  │    "March 15th"           │
  │                           │
  │── follow-up ──────────────▶│── notification ────▶ 🦞 [HS-7X3K9Q2M] Follow-up
  │   "Any dependencies?"      │                        📝 Any dependencies?
  │                           │
  │                           │◀── your reply ───────── [HS-7X3K9Q2M] Yes, needs
  │◀── response ──────────────│                          sign-off from legal
  │    "Yes, needs sign-off   │
  │     from legal"           │
```

---

## Tips

- **No need to open the dashboard** — everything works from your messaging app
- **Ref codes are 8 characters** (e.g. `HS-7X3K9Q2M`) — always include them
- **Reply quotes work** — on Telegram, replying to the notification auto-detects the ref code
- **Long responses are fine** — write as much detail as needed after the tag
- **Response is fast** — the agent receives your answer on the next poll cycle

---

## Setting Up Provider Notifications

To receive requests in your messaging app, configure the provider watcher in your OpenClaw setup:

```env
HEYSUMMON_BASE_URL=http://localhost:3445
HEYSUMMON_API_KEY=hs_prov_xxxxxxxxxxxxxxxxxxxx
HEYSUMMON_NOTIFY_TARGET=<your_chat_id>
```

Then start the watcher:

```bash
bash scripts/setup.sh
```

See [QUICK_START.md](../QUICK_START.md) for full setup instructions.
