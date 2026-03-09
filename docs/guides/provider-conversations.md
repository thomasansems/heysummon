# Provider conversations

As a provider (human expert), you can respond to help requests directly from your messaging app — no need to open the dashboard.

---

## How it works

When an AI agent submits a request, you receive a notification:

```
🦞 HeySummon [HS-A1B2C3D4] New request
📝 Should I delete the production database?
```

The `[HS-XXXXXXXX]` tag is the **reference code** for that conversation.

---

## Responding

### Via messaging app (Telegram)

**Option 1: Reply to the notification**

Reply to the notification message — your assistant (e.g. OpenClaw) detects the ref code from the quoted message and forwards your response automatically.

```
You reply: "No, never delete production databases."
       ↓
✅ Response sent to agent
```

**Option 2: Include the ref code in a new message**

```
[HS-A1B2C3D4] No, never delete production databases.
```

Everything after the tag is sent as the response.

### Via dashboard

1. Open the dashboard
2. Click the request with the matching ref code
3. Read the decrypted question
4. Type and submit your response

---

## Multi-turn conversations

Requests support multiple back-and-forth messages. Follow-ups share the same ref code:

```
🦞 HeySummon [HS-A1B2C3D4] Follow-up
📝 What should I do instead?
```

Respond the same way — the ref code links it to the same conversation thread.

---

## Full example flow

```
Agent ──── "Should I delete the DB?" ────▶ HeySummon
                                                │
                                      Notification to you:
                                      [HS-A1B2C3D4] Should I delete the DB?
                                                │
You reply: "No" ────────────────────▶ HeySummon ────▶ Agent gets "No"

Agent ──── "What should I do?" ──────▶ HeySummon
                                                │
                                      [HS-A1B2C3D4] What should I do?
                                                │
You reply: "Archive it instead" ─────▶ HeySummon ────▶ Agent gets the answer
```

---

## Setting up notifications

Configure the provider watcher to receive notifications in your messaging app:

```env
# ~/clawd/skills/heysummon-provider/.env
HEYSUMMON_BASE_URL=http://localhost:3445
HEYSUMMON_API_KEY=hs_prov_abc123...
HEYSUMMON_NOTIFY_TARGET=<your_telegram_chat_id>
```

Start the watcher:

```bash
bash ~/clawd/skills/heysummon-provider/scripts/setup.sh
```

Check watcher logs:

```bash
tail -50 ~/clawd/skills/heysummon-provider/watcher.log
```

---

## Tips

- **Ref codes are 8 chars** — always `HS-XXXXXXXX`
- **Reply quotes work** — Telegram's "Reply" feature auto-detects the ref code
- **Response is fast** — the agent receives your answer on the next poll cycle
- **Dashboard is always there** — fallback for when notifications don't work
