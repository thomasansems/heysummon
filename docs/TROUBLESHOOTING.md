# Troubleshooting

## Real-time Server (Mercure)

### Status: Disconnected / "fetch failed"

The dashboard shows a red banner when it can't reach the Mercure hub.

**Common causes:**

| Cause | Solution |
|-------|----------|
| Mercure process stopped/crashed | Restart it (see below) |
| Wrong `MERCURE_HUB_URL` | Check `.env` / `.env.local` — default: `http://localhost:3426/.well-known/mercure` |
| Port conflict | Another service using port 3100 |
| Firewall blocking internal traffic | Ensure localhost:3426 is reachable from the app |

**Restart Mercure:**

```bash
# Docker setup
docker compose restart mercure

# NPX / self-hosted setup (pm2)
pm2 restart mercure

# Manual start (development)
./start-mercure.sh
```

**Verify it's running:**

```bash
curl http://localhost:3426/healthz
# Expected: 200 OK
```

### Status: Unhealthy / HTTP 401

Mercure is running but rejecting requests. This usually means:
- Anonymous subscriptions are disabled (expected in production)
- The health check is using the wrong endpoint

The dashboard health check uses `/healthz` which doesn't require authentication. If you see 401, your Mercure version may not support `/healthz` — update to the latest Mercure release.

---

## Dashboard: 500 Internal Server Error

### "Table does not exist"

Database migrations haven't been applied:

```bash
# SQLite (npx / development)
npx prisma db push

# PostgreSQL (Docker)
docker compose exec app npx prisma db push
```

### Wrong database file

If you have both `.env` and `.env.local`, Next.js loads `.env` first. Make sure `DATABASE_URL` in `.env` doesn't override your `.env.local` settings. When in doubt, only use `.env.local` for local development.

---

## SSE Notifications Not Delivered

1. Check Mercure is running: `curl http://localhost:3426/healthz`
2. Check `MERCURE_JWT_SECRET` matches between app and Mercure config
3. Check browser console for SSE connection errors
4. For Docker: ensure Mercure is on the `backend` network

---

## Debug Tools

### Prisma Studio (Database Browser)

Inspect and edit the database directly via a web UI:

```bash
docker compose --profile debug up -d
```

Opens Prisma Studio at `http://localhost:3447`. Only starts when you explicitly use the `debug` profile — never runs in production.

To stop: `docker compose --profile debug down` or just `docker compose down`.

---

## Need Help?

- [GitHub Issues](https://github.com/thomasansems/heysummon/issues)
- [Documentation](https://docs.heysummon.ai)
