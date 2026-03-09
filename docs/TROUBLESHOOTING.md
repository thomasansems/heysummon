# Troubleshooting

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

## Provider Not Receiving Notifications

1. Check the provider polling watcher is running: `ps aux | grep poll-watcher`
2. Verify `HEYSUMMON_API_KEY` starts with `hs_prov_` (provider key)
3. Check OpenClaw is running: `curl http://localhost:18789/health`
4. Check watcher logs: `tail -50 watcher.log` (in the provider skill directory)
5. Restart watcher: `bash scripts/teardown.sh && bash scripts/setup.sh`

---

## Provider Shows as Inactive on Dashboard

The dashboard monitors provider polling activity. If the provider hasn't polled in the last 60 seconds, it shows as inactive.

**Common causes:**
- Watcher process crashed or was stopped
- Network connectivity issues
- Wrong `HEYSUMMON_BASE_URL` in `.env`

**Fix:** Restart the watcher: `bash scripts/setup.sh`

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
