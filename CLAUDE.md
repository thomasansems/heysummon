# HeySummon — Claude Code Guidelines

## Documentation

### Single source of truth

All user-facing documentation lives in **`/website/pages/`**. The `/docs/` directory
contains legacy markdown files kept for reference — do not treat it as the live docs.

When building or reviewing features, always check and update `/website/pages/` — not `/docs/`.

### Keep docs in sync with code

**When you change a feature, update the documentation.** This is not optional.

- If you add, change, or remove an API endpoint → update `/website/pages/reference/api.mdx` and any relevant guide pages.
- If you change the CLI, Docker setup, or NPX installer → update `/website/pages/self-hosting/`.
- If you change authentication, keys, or encryption behaviour → update `/website/pages/security/` and `/website/pages/consumer/encryption.mdx`.
- If you change the provider dashboard, Telegram integration, or event model → update `/website/pages/provider/`.
- If you add a new top-level feature → create a new page in the appropriate section and add it to the section's `_meta.js`.

### Changelog

Every meaningful change should be reflected in the changelog:

**File:** `/website/pages/reference/changelog.mdx`

Format:

```md
## vX.Y.Z — YYYY-MM-DD

### Added
- Short description

### Changed
- Short description

### Fixed
- Short description
```

Add entries at the **top** of the file, newest first.

---

## Development

### Branch

Develop on feature branches, never directly on `main`. The docs are automatically
deployed to `docs.heysummon.ai` on every push to `main`.

### Tests

- Unit tests: `npm run test`
- E2E tests: `npm run test:e2e`

Run both before opening a PR.

### Database

- Schema: `prisma/schema.prisma`
- Migrations: `npx prisma migrate dev --name <description>`
- Never edit migration files after they have been applied.

---

## Security

- Never log or expose API keys, secrets, or private keys.
- All API endpoints must go through the Guard proxy — do not add routes that bypass it.
- Content safety scanning runs in Guard — do not remove or skip it.
- E2E encryption is opt-in for consumers — the platform must never store plaintext for encrypted requests.
