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
