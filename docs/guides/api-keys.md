# API keys

HeySummon uses two types of API keys with different access levels.

---

## Key types

| Type | Prefix | Used by | Can do |
|------|--------|---------|--------|
| **Client key** | `hs_live_` | AI agents, SDKs | Submit requests, poll responses, send messages |
| **Provider key** | `hs_prov_` | Watcher scripts, integrations | Receive SSE events, send provider responses, look up requests by ref code |

---

## Creating a key

1. Open the dashboard → **API Keys**
2. Click **Create Key**
3. Choose a name and type
4. Copy the key — it's only shown once

---

## Key security

- Keys are hashed with bcrypt before storage — the platform cannot recover them
- Keys can be **rotated** — the old key stays valid for 24 hours after rotation (grace period)
- Keys can be **scoped** — limit to specific operations
- Keys can be **IP-restricted** — only allow requests from specific IPs
- Keys can require a **device token** — bind to a specific device

---

## Key rotation

```bash
# Via dashboard: API Keys → ••• → Rotate
# Old key valid for 24h after rotation
```

Or via API:

```bash
curl -X POST http://localhost:3000/api/keys/KEY_ID/rotate \
  -H "Cookie: <session>"
```

---

## IP allowlisting

Restrict a key to specific IP addresses in the dashboard:

```
API Keys → Select key → Settings → Allowed IPs
```

Format: single IPs or CIDR ranges:
```
192.168.1.100
10.0.0.0/8
```

---

## Scopes

| Scope | Description |
|-------|-------------|
| `help:write` | Submit help requests |
| `help:read` | Poll request status |
| `message:write` | Send messages |
| `stream:read` | Connect to SSE stream |

---

## Audit log

Every key action is logged in **Audit Logs** (dashboard → Audit Logs):

- Key created
- Key rotated
- Key deleted
- Help request submitted
- Provider response sent
