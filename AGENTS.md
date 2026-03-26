# AGENTS.md — HeySummon AI Coding Guidelines

This file contains rules and conventions for AI coding agents (Claude Code, Codex, etc.)
working on the HeySummon codebase.

---

## 📚 Documentation Rules

### Always update docs when features change

When you modify, add, or remove a feature that affects **any of the following**:

- API endpoints (`/api/v1/*`)
- Provider or consumer behavior
- Authentication or security model
- SDK package interface
- Self-hosting configuration
- Environment variables

...you **MUST** update the corresponding documentation in `website/pages/`.

**Mapping:**
| Code area | Docs file |
|-----------|-----------|
| `/api/v1/help`, `/api/v1/message`, etc. | `website/pages/reference/` or `website/pages/consumer/` |
| Provider polling, notifications | `website/pages/provider/` |
| Self-hosting setup, env vars | `website/pages/self-hosting/` |
| Security model, Guard proxy | `website/pages/security/` |
| SDK (`packages/consumer-sdk/`) | `website/pages/consumer/sdk.mdx` |

### Changelog

When you make a **user-facing change**, add an entry to `CHANGELOG.md` in the format:

```md
## [Unreleased]

### Added
- Brief description of new feature

### Changed
- Brief description of change

### Fixed
- Brief description of bug fix
```

---

## 🔒 Critical Restrictions

- **NEVER run `prisma migrate reset` or `DROP DATABASE`** — destructive DB operations require explicit human approval
- **NEVER merge PRs directly** — always create a PR and wait for Thomas to approve
- **NEVER push directly to `main`** — always use a feature branch

---

## 🏗️ Architecture Overview

- **Platform**: Next.js 16 app at `src/app/`
- **Database**: Prisma + SQLite (`prisma/heysummon.db`)
- **Guard proxy**: `guard/` — Ed25519-signed receipt validation
- **Consumer SDK**: `packages/consumer-sdk/` → `@heysummon/consumer`
- **Docs**: `website/` → deployed to `docs.heysummon.ai` via Vercel
- **E2E tests**: `e2e/` (bash) + `tests/e2e/` (Playwright)

---

## 🧪 Testing

Before pushing, always run:

```bash
npm run lint          # 0 errors required
npm run build         # must compile successfully
npm run test          # unit tests
```

For E2E tests, see `e2e/README.md`.

---

## 📝 PR Conventions

- Branch name: `feat/`, `fix/`, `chore/`, `docs/`
- PR title: conventional commits format (`feat: ...`, `fix: ...`)
- Include a short description of what changed and why
- Tag affected docs files if documentation was updated
