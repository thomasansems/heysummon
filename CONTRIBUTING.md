# Contributing to HITLaaS

Thanks for your interest in contributing! Here's how to get started.

## Development Setup

```bash
git clone https://github.com/thomasansems/hitlaas-platform.git
cd hitlaas-platform
cp .env.example .env.local   # configure your environment
npm install
npx prisma generate
npx prisma db push
npm run dev
```

## Running Tests

```bash
npm run test          # unit tests (vitest)
npm run test:watch    # watch mode
npm run test:e2e      # end-to-end tests (Playwright)
```

## Pull Request Guidelines

- Branch from `main`
- Use descriptive commit messages
- Keep PRs focused — one feature or fix per PR
- Ensure `npm run test` and `npm run build` pass before submitting
- Update documentation if applicable

## Code Style

- **TypeScript** throughout
- **ESLint** for linting (`npm run lint`)
- Use `@/` path aliases for imports
- Prefer functional components and server components where possible

## Security Vulnerabilities

**Do not open a public issue for security vulnerabilities.**

Please report security issues via email to: **security@thomasansems.nl**

Include a description of the vulnerability, steps to reproduce, and any potential impact.
