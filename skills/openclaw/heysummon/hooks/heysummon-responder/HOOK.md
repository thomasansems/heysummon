---
name: heysummon-responder
description: "Automatically wake the agent when a HeySummon provider response arrives via message:sent"
metadata: { "openclaw": { "emoji": "🦞", "events": ["message:sent"], "requires": { "bins": ["node"] } } }
---

# HeySummon Responder Hook

This hook listens for outbound messages. When it detects a HeySummon provider response
notification (starting with "📩 Nieuw antwoord van provider"), it automatically calls
`/hooks/agent` to wake the configured agent so it can act on the answer.

## Flow

```
Provider responds
    ↓
HeySummon watcher sends Telegram notification
    ↓
message:sent fires
    ↓
This hook detects "📩 Nieuw antwoord" prefix
    ↓
Calls /hooks/agent on the configured agent (default: tertiary)
    ↓
Agent wakes up, reads response, acts on it
```

## Configuration

Reads config from `~/.openclaw/openclaw.json`:
- `hooks.token` — required for /hooks/agent auth
- `gateway.port` — defaults to 18789

Agent ID is read from the skill .env (`HEYSUMMON_AGENT_ID`), defaults to `tertiary`.

## Loop prevention

Only fires when message content starts with "📩 Nieuw antwoord van provider".
Agent replies never match this pattern, so no infinite loop.
