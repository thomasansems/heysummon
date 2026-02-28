# Contributing to HeySummon

Thanks for your interest in contributing! This guide covers everything you need to get started.

## Development Setup

```bash
git clone https://github.com/thomasansems/heysummon.git
cd heysummon
cp .env.example .env.local   # configure your environment
npm install
npx prisma generate
npx prisma db push
npm run dev
```

The app runs on [http://localhost:3425](http://localhost:3425) by default.

## Code Style

- **TypeScript** throughout the codebase
- **ESLint** for linting — run `npm run lint`
- Uses `next/core-web-vitals` and `next/typescript` ESLint presets
- Use `@/` path aliases for imports
- Prefer functional components and server components where possible

## Branch Naming Convention

Use a prefix that describes the type of change:

| Prefix   | Use for                        |
| -------- | ------------------------------ |
| `feat/`  | New features                   |
| `fix/`   | Bug fixes                      |
| `docs/`  | Documentation changes          |

Examples: `feat/webhook-retry`, `fix/auth-redirect`, `docs/contributing`

## Pull Request Process

1. Branch from `main`
2. Keep PRs focused — one feature or fix per PR
3. Write a clear description of **what** changed and **why**
4. Link related issues (e.g. `Closes #123`)
5. Ensure all checks pass before requesting review:
   ```bash
   npm run lint
   npm run test
   npm run build
   ```
6. Update documentation if your change affects user-facing behavior

## Testing

### Unit Tests (Vitest)

```bash
npm run test          # single run
npm run test:watch    # watch mode
```

### End-to-End Tests (Playwright)

```bash
npm run test:e2e      # requires the app to be running
```

There is also a self-contained E2E script that seeds test data and runs the suite locally:

```bash
bash e2e/run-local.sh
```

### Run Everything

```bash
npm run test:all      # unit + e2e
```

## Security Vulnerabilities

**Do not open a public issue for security vulnerabilities.**

Please report security issues via email to: **security@heysummon.ai**

Include a description of the vulnerability, steps to reproduce, and any potential impact.

## License

By contributing to HeySummon you agree that your contributions will be licensed under the [Summon Use License (SUL)](LICENSE.md).
