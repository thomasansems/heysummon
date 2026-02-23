# HeySummon Networking Guide

Comprehensive guide to cross-network connectivity for HeySummon. Covers how AI agents on one network reach a provider's HeySummon instance on another network.

## Architecture Overview

HeySummon uses a layered architecture where all external traffic passes through a content-safety Guard before reaching the Platform:

```
┌──────────────────────────────────────────────────────────────────────┐
│                        CONSUMER NETWORK                              │
│                                                                      │
│  ┌─────────────┐                                                     │
│  │  AI Agent    │──── HTTPS request ──→                               │
│  │  (Consumer)  │                      │                              │
│  └─────────────┘                      │                              │
└───────────────────────────────────────┼──────────────────────────────┘
                                        │
                                   [ Internet ]
                                        │
┌───────────────────────────────────────┼──────────────────────────────┐
│                        PROVIDER NETWORK                              │
│                                        │                              │
│  ┌─────────────────────────────────────┼────────────────────────┐    │
│  │                     Docker Compose                            │    │
│  │                                     │                         │    │
│  │  ┌──────────────────────┐           │                         │    │
│  │  │  Tunnel Service      │◄──────────┘                         │    │
│  │  │  (Cloudflare/TS/Ngrok)           (frontend network)        │    │
│  │  └──────────┬───────────┘                                     │    │
│  │             │                                                  │    │
│  │             ▼                                                  │    │
│  │  ┌──────────────────────┐                                     │    │
│  │  │  Guard (:3000)       │  ← Single entry point               │    │
│  │  │  • Content validation │                                     │    │
│  │  │  • XSS sanitization  │  (frontend + backend networks)      │    │
│  │  │  • PII detection     │                                     │    │
│  │  │  • Ed25519 signing   │                                     │    │
│  │  └──────────┬───────────┘                                     │    │
│  │             │                                                  │    │
│  │  ═══════════╪════════════════════════════════════════          │    │
│  │             │        (backend network — internal only)         │    │
│  │             ▼                                                  │    │
│  │  ┌──────────────────────┐   ┌──────────┐   ┌─────────────┐   │    │
│  │  │  Platform (:3000)    │──▶│ Postgres │   │  Mercure     │   │    │
│  │  │  (Next.js app)       │   │ (:5432)  │   │  (SSE hub)   │   │    │
│  │  └──────────────────────┘   └──────────┘   └─────────────┘   │    │
│  │                                                               │    │
│  └───────────────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────────────┘
```

### Key principles

1. **Guard is the single entry point** — all external traffic goes through Guard first
2. **Platform has no exposed ports** — it lives on an internal Docker network
3. **Tunnel services connect to Guard** — never directly to Platform
4. **Guard validates content** — XSS sanitization, URL defanging, PII detection, credit card blocking
5. **Guard signs receipts** — Ed25519 cryptographic proof that content passed validation

## Request Flow

When an AI agent sends a help request, this is the full flow:

```
1. Agent → POST /api/v1/help (with x-api-key header)
           │
2.         ▼ Tunnel terminates TLS, forwards to Guard
           │
3.   Guard │ Extracts text content from request body
           │ Runs content safety pipeline:
           │   • DOMPurify HTML sanitization
           │   • URL defanging (https → hxxps)
           │   • PII detection (CC, SSN, email, phone)
           │ BLOCKS if credit card or SSN detected
           │ Creates Ed25519 receipt: SHA256(sanitized_text) + timestamp + nonce
           │ Attaches X-Guard-Receipt + X-Guard-Receipt-Sig headers
           │
4.         ▼ Proxies to Platform on backend network
           │
5. Platform│ Validates API key
           │ Verifies Guard receipt (Ed25519 signature, timestamp, nonce)
           │ Creates HelpRequest in database
           │ Publishes event to Mercure
           │
6.         ▼ Returns { requestId, refCode, status }
```

## Connectivity Options

### Decision Tree

```
Need cross-network connectivity?
│
├── Yes, for production
│   └── Do you have a custom domain?
│       ├── Yes → Cloudflare Tunnel ★
│       └── No  → Tailscale Funnel (*.ts.net URL)
│
├── Yes, for testing
│   └── Ngrok (quick, but URL changes)
│
└── No, local only
    └── Direct (docker compose up -d)
```

### Comparison

| | Cloudflare Tunnel | Tailscale Funnel | Ngrok | Direct |
|---|---|---|---|---|
| **Setup time** | 5-10 min | 3-5 min | 2 min | 0 min |
| **Cost** | Free | Free | Free (limited) | Free |
| **Custom domain** | Yes | No | Paid | N/A |
| **Stable URL** | Yes | Yes | No (free tier) | N/A |
| **TLS** | Automatic | Automatic | Automatic | Manual |
| **SSE streaming** | Native | Native | May buffer | N/A |
| **DDoS protection** | Yes | No | No | No |
| **Access policies** | Yes (Zero Trust) | Yes (ACLs) | Basic | Manual |
| **Latency added** | ~5-20ms | ~5-15ms | ~10-30ms | 0ms |
| **Inbound ports** | None needed | None needed | None needed | Yes |
| **Production-ready** | Yes | Yes (team) | No | Depends |

### Security Comparison

| Threat | Cloudflare | Tailscale | Ngrok | Direct |
|---|---|---|---|---|
| **DDoS** | Protected | Exposed | Exposed | Exposed |
| **IP exposure** | Hidden | Hidden | Hidden | Visible |
| **Man-in-the-middle** | TLS + CF edge | WireGuard E2E | TLS | Manual TLS |
| **Brute force** | Rate limiting available | ACL-based | IP restriction (paid) | Manual |
| **URL guessing** | Custom domain | Predictable *.ts.net | Random (changes) | Known IP |

In all cases, Guard provides an additional layer of content safety regardless of which tunnel is used.

---

## Detailed Setup Guides

### Cloudflare Tunnel

**Requirements**: Cloudflare account, domain on Cloudflare DNS

#### 1. Create the tunnel

1. Go to [Cloudflare Zero Trust Dashboard](https://one.dash.cloudflare.com)
2. Navigate to **Networks** → **Tunnels**
3. Click **Create a tunnel**
4. Name it `heysummon`
5. Copy the tunnel token

#### 2. Configure the public hostname

In the tunnel configuration, add a public hostname:
- **Subdomain**: `heysummon` (or your choice)
- **Domain**: your domain on Cloudflare
- **Service**: `http://heysummon-guard:3000`

> **Critical**: Point to `heysummon-guard:3000` (Guard), NOT `app:3000` (Platform).

#### 3. Configure environment

```bash
# .env
CLOUDFLARE_TUNNEL_TOKEN=your-tunnel-token-here
NEXTAUTH_URL=https://heysummon.yourdomain.com
HEYSUMMON_PUBLIC_URL=https://heysummon.yourdomain.com
CONNECTIVITY_METHOD=cloudflare
```

#### 4. Start

```bash
docker compose --profile cloudflare up -d
```

#### 5. Verify

```bash
# Check tunnel status
docker compose logs cloudflared

# Test health through tunnel
curl https://heysummon.yourdomain.com/api/health
```

#### SSE notes

Cloudflare handles Server-Sent Events natively. No special configuration needed. Events stream through without buffering.

---

### Tailscale Funnel

**Requirements**: Tailscale account, Funnel enabled in ACL policy

#### 1. Enable Funnel

In your Tailscale admin, update your ACL policy to allow Funnel:

```json
{
  "nodeAttrs": [
    {
      "target": ["tag:heysummon"],
      "attr": ["funnel"]
    }
  ]
}
```

#### 2. Generate an auth key

1. Go to [Tailscale Admin](https://login.tailscale.com/admin/settings/keys)
2. Generate a new auth key:
   - **Reusable**: Yes
   - **Tags**: `tag:heysummon`
   - **Expiry**: Your preference

#### 3. Configure environment

```bash
# .env
TAILSCALE_AUTHKEY=tskey-auth-xxxxx
NEXTAUTH_URL=https://heysummon.your-tailnet.ts.net
HEYSUMMON_PUBLIC_URL=https://heysummon.your-tailnet.ts.net
CONNECTIVITY_METHOD=tailscale
```

#### 4. Serve config

The `tailscale-config/serve.json` file is pre-configured to route traffic to Guard:

```json
{
  "TCP": { "443": { "HTTPS": true } },
  "Web": {
    "heysummon.ts.net:443": {
      "Handlers": {
        "/": { "Proxy": "http://heysummon-guard:3000" }
      }
    }
  }
}
```

#### 5. Start

```bash
docker compose --profile tailscale up -d
```

#### 6. Verify

```bash
# Check Tailscale status
docker compose exec tailscale tailscale status

# Test health through funnel
curl https://heysummon.your-tailnet.ts.net/api/health
```

---

### Ngrok

**Requirements**: Ngrok account (free or paid)

#### 1. Get auth token

1. Sign up at [ngrok.com](https://ngrok.com)
2. Copy your auth token from the [dashboard](https://dashboard.ngrok.com/get-started/your-authtoken)

#### 2. Configure environment

```bash
# .env
NGROK_AUTHTOKEN=your-ngrok-token
CONNECTIVITY_METHOD=ngrok

# Optional: custom domain (paid plans)
# NGROK_DOMAIN=heysummon.ngrok.io
```

#### 3. Start

```bash
docker compose --profile ngrok up -d
```

#### 4. Find your URL

```bash
# Check ngrok inspector for your public URL
curl -s http://localhost:4040/api/tunnels | jq '.tunnels[0].public_url'
```

Then update your `.env`:
```bash
NEXTAUTH_URL=https://xxxx-xx-xx-xx-xx.ngrok-free.app
HEYSUMMON_PUBLIC_URL=https://xxxx-xx-xx-xx-xx.ngrok-free.app
```

#### SSE notes

Ngrok may buffer SSE responses, especially on the free tier. Symptoms:
- Real-time notifications arrive in batches instead of immediately
- Events appear delayed by several seconds

Workarounds:
- Use a paid ngrok plan
- Switch to Cloudflare Tunnel for production
- The Platform falls back to polling if SSE is unavailable

---

### Direct / Manual

No tunnel — you handle external access yourself (VPS, port forwarding, Nginx/Caddy, etc.).

```bash
docker compose up -d
```

If using an external reverse proxy, point it to Guard's port:

```nginx
# Nginx example
server {
    listen 443 ssl;
    server_name heysummon.example.com;

    # Important for SSE: disable buffering
    proxy_buffering off;
    proxy_cache off;

    location / {
        proxy_pass http://localhost:3000;  # Guard port
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # SSE support
        proxy_set_header Connection '';
        proxy_http_version 1.1;
        chunked_transfer_encoding off;
    }
}
```

```
# Caddyfile example
heysummon.example.com {
    reverse_proxy localhost:3000  # Guard port
}
```

---

## Performance Notes

### Latency by option

Measured as additional round-trip time compared to direct access:

| Option | Added latency | Notes |
|---|---|---|
| Cloudflare Tunnel | 5-20ms | Depends on nearest Cloudflare PoP |
| Tailscale Funnel | 5-15ms | Direct WireGuard, uses DERP if needed |
| Ngrok | 10-30ms | Routes through ngrok edge servers |
| Direct | 0ms | No additional hop |

### SSE/streaming performance

| Option | SSE behavior | Workaround |
|---|---|---|
| Cloudflare | Streams natively | None needed |
| Tailscale | Streams natively | None needed |
| Ngrok | May buffer events | Paid plan or switch tunnel |
| Direct + Nginx | Needs `proxy_buffering off` | See Nginx config above |
| Direct + Caddy | Streams natively | None needed |

### Throughput

All tunnel options handle typical HeySummon workloads (help requests, messages, SSE events) without issues. HeySummon is not bandwidth-intensive — the payload is small text-based JSON.

---

## Troubleshooting

### Tunnel connects but requests fail

```bash
# Verify Guard is healthy
curl http://localhost:3000/health

# Verify Platform is healthy through Guard
curl http://localhost:3000/api/health

# Check if the tunnel can reach Guard
docker compose logs <tunnel-service>
```

### SSE events not arriving in real-time

1. Check if events work locally (bypass tunnel):
   ```bash
   curl -N http://localhost:3000/api/v1/events/stream -H "x-api-key: YOUR_KEY"
   ```

2. If local works but tunnel doesn't, the tunnel is buffering SSE. See SSE notes for your tunnel option above.

3. Check Mercure is healthy:
   ```bash
   docker compose logs mercure
   ```

### Guard receipt verification fails

The Platform verifies Guard receipts with a 5-minute time window. If clocks are skewed between containers:

```bash
# Check container time
docker compose exec app date
docker compose exec heysummon-guard date
```

Docker containers share the host clock, so this is rarely an issue. If it is, ensure your host's NTP is configured.

### Connection drops through tunnel

Some tunnels have idle timeouts. HeySummon SSE connections send periodic heartbeats, but if you see drops:

- **Cloudflare**: Increase timeout in tunnel config
- **Tailscale**: Reconnects automatically via WireGuard
- **Ngrok**: Reconnects automatically, but free URLs change

### Testing the full flow

```bash
# 1. Check Guard
curl http://localhost:3000/health
# → {"ok":true}

# 2. Check Platform through Guard
curl http://localhost:3000/api/health
# → {"status":"ok","guard":{"enabled":true,"reachable":true}}

# 3. Check through tunnel (replace with your URL)
curl https://your-tunnel-url.com/api/health

# 4. Submit a test help request
curl -X POST https://your-tunnel-url.com/api/v1/help \
  -H "x-api-key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"question": "Cross-network test"}'
```

---

## Future: HeySummon Cloud Relay

> **Note**: This feature is not yet built. This section documents the planned architecture.

### Concept

A public relay service that enables cross-network connectivity without any tunnel setup. Both the consumer and provider connect **outbound** to the relay — no inbound ports, no tunnel configuration.

```
┌──────────────┐        ┌─────────────────────┐        ┌──────────────┐
│   Consumer   │──out──▶│  HeySummon Cloud     │◀──out──│   Provider   │
│   (Agent)    │        │  Relay               │        │   (Platform) │
│              │◀───────│  • Message routing    │───────▶│              │
└──────────────┘        │  • Zero-knowledge    │        └──────────────┘
                        │  • E2E encrypted     │
                        └─────────────────────┘
```

### How it would work

1. **Provider registers** with the relay using their API key
2. **Consumer sends** an encrypted help request to the relay
3. **Relay routes** the message to the correct provider based on API key
4. **Provider receives** the encrypted message, processes it, sends response back through relay
5. **Consumer polls** the relay for the response

### Security properties

- **Zero-knowledge**: The relay sees only encrypted payloads, never plaintext
- **E2E encryption**: Messages are encrypted with the consumer-provider shared secret (X25519 ECDH)
- **No tunnel needed**: Both sides make outbound connections only
- **Metadata minimal**: Relay knows API key routing, but not message content

### Similar to

- **Matrix federation**: Decentralized, but messages encrypted at rest
- **Tailscale DERP relays**: Fallback relay when direct WireGuard fails
- **Signal sealed sender**: Relay knows the destination but not the sender content

### When to use (once built)

The relay would be the simplest option for users who:
- Don't want to set up any tunnel
- Are okay with adding relay latency (~50-100ms)
- Trust HeySummon's relay infrastructure (or run their own relay)
- Want zero-config cross-network connectivity

The relay service code already exists in the `relay/` directory as a prototype. It is not yet integrated into the main Docker Compose stack or connected to the cloud service.
