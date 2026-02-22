# HeySummon Security Overview

This document describes the security architecture, controls, and practices in HeySummon. It is intended for security-conscious teams and enterprise evaluators assessing the platform.

---

## Table of Contents

1. [Architecture Security](#architecture-security)
2. [Authentication](#authentication)
3. [API Security](#api-security)
4. [Data Protection](#data-protection)
5. [Rate Limiting](#rate-limiting)
6. [Responsible Disclosure](#responsible-disclosure)
7. [Security Roadmap](#security-roadmap)

---

## Architecture Security

HeySummon follows a defense-in-depth approach to its deployment architecture:

- **Mercure hub isolation** — The Mercure real-time messaging hub is never exposed to the public internet. It runs on a Docker-internal network and is only reachable by the application server.
- **SSE proxy with authentication** — Server-Sent Events (SSE) connections from clients pass through an authenticated proxy layer. The application validates the user's session before establishing the upstream Mercure subscription, ensuring that unauthenticated clients cannot subscribe to any topic.
- **SQLite file permissions** — The SQLite database file is stored with restrictive filesystem permissions (`chmod 600`), readable and writable only by the application process owner.

## Authentication

- **Form-based login** — Users authenticate via a standard login form. Passwords are hashed using **bcrypt with a cost factor of 12**, providing strong resistance against brute-force and rainbow-table attacks.
- **JWT sessions** — Authenticated sessions are managed with signed JSON Web Tokens (JWT). Tokens are issued on successful login and validated on each request.
- **OAuth (opt-in)** — OAuth-based authentication is supported as an optional integration for organisations that prefer delegated identity providers. It is not enabled by default.

## API Security

- **API key authentication** — External API access is authenticated via the `x-api-key` HTTP header. Keys are generated per-account and stored securely.
- **Key scoping** — API keys are scoped by role:
  - **Client keys** are limited to consumer-facing operations (e.g., submitting requests, reading status).
  - **Provider keys** have access to provider-specific endpoints (e.g., claiming and resolving requests).
- **Soft-delete** — API keys are soft-deleted rather than permanently removed, preserving an audit trail and preventing accidental re-use of revoked credentials.

## Data Protection

- **SQLite file permissions** — The database file is created with `chmod 600`, restricting access to the owning process user only.
- **Docker internal network** — All backend services (application server, Mercure hub, SQLite) communicate over a Docker-internal bridge network that is not exposed to the host or external networks.
- **No database port exposure** — Unlike traditional RDBMS deployments, there is no TCP database port to secure or accidentally expose. SQLite is accessed via the local filesystem only.

## Rate Limiting

HeySummon enforces per-client rate limits to protect against abuse and ensure fair resource usage:

| Endpoint type | Limit |
|---|---|
| Page requests | 120 requests/minute |
| API requests | 60 requests/minute |
| Polling requests | 30 requests/minute |
| SSE connections | Exempt (long-lived) |

SSE connections are exempt from per-minute rate limiting because they are persistent, long-lived connections rather than repeated short requests.

## Responsible Disclosure

We take security vulnerabilities seriously. If you discover a potential security issue, please report it responsibly:

- **Email:** [security@heysummon.com](mailto:security@heysummon.com)
- Include a clear description of the vulnerability, steps to reproduce, and any relevant proof-of-concept material.
- Do **not** open a public GitHub issue for security vulnerabilities.
- We will acknowledge receipt within 48 hours and aim to provide a fix or mitigation timeline within 7 business days.

## Security Roadmap

The following security enhancements are planned:

| Feature | Status |
|---|---|
| JWT refresh tokens | Planned |
| Audit logging | Planned |
| Zod schema validation (input sanitisation) | Planned |
| Independent penetration test | Planned |

---

*Last updated: February 2026*
