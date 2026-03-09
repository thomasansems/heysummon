# Security Policy

## Reporting a Vulnerability

**Please do not report security vulnerabilities through public GitHub issues.**

If you discover a security vulnerability in HeySummon, please report it by emailing:

📧 **security@heysummon.dev**

Include as much detail as possible:
- Type of vulnerability (e.g., XSS, injection, auth bypass, cryptographic weakness)
- Affected component(s) and version(s)
- Steps to reproduce or a proof-of-concept (avoid exploiting real user data)
- Potential impact assessment
- Your suggested fix (if any)

You will receive an acknowledgment within **48 hours** and an initial assessment within **7 business days**.

### Encrypted Reports (optional)

If you'd like to encrypt your report, please request our PGP public key in your initial email and we'll share it promptly.

---

## Supported Versions

| Version     | Status      | Security Updates |
|-------------|-------------|-----------------|
| `main`      | ✅ Active    | Yes             |
| `< 1.0.0`  | ⚠️ Alpha    | Best-effort     |

We strongly recommend running the latest version. Alpha releases may receive breaking security fixes without advance notice.

---

## Responsible Disclosure Policy

We follow a **coordinated disclosure** model:

1. **Report** — You report the vulnerability to us privately.
2. **Acknowledge** — We confirm receipt within 48 hours.
3. **Assess** — We evaluate severity and reproduce the issue within 7 business days.
4. **Fix** — We develop and test a patch. Timeline depends on severity:
   - **Critical / High**: patch within 14 days
   - **Medium**: patch within 30 days
   - **Low**: patch within 90 days
5. **Coordinate** — We agree on a disclosure date with you.
6. **Disclose** — We publish the fix and a security advisory. You get credit (if desired).

**We ask that you:**
- Give us reasonable time to fix the issue before public disclosure
- Not exploit the vulnerability beyond what's needed to demonstrate it
- Not access, modify, or delete data belonging to other users

---

## Recognition

We don't currently offer a paid bug bounty program. However, we will:
- Credit you by name (or pseudonym) in the security advisory and release notes
- Add you to our **Hall of Thanks** in this file (below)
- Provide a LinkedIn recommendation for significant findings (on request)

---

## Scope

**In scope:**
- HeySummon server (`/src`, `/api`)
- Authentication and authorization flows
- End-to-end encryption implementation (Guard, key exchange)
- API key handling and IP binding
- MCP server (`packages/mcp-server`)
- CLI (`cli/`)

**Out of scope:**
- Vulnerabilities in third-party dependencies (report to the upstream project)
- Issues requiring physical access to the server
- Social engineering or phishing attacks
- Denial-of-service attacks via resource exhaustion (unless trivially exploitable)
- Findings from automated scanners without manual verification

---

## Security Design Notes

HeySummon is designed with security as a core principle:

- **End-to-end encryption**: Messages between providers and consumers use asymmetric Ed25519/NaCl cryptography. The server never sees plaintext message content.
- **Guard receipts**: Every API call includes a cryptographically signed receipt verifying request integrity.
- **API key scoping**: Keys are role-scoped (`provider` / `consumer`) and cannot be used interchangeably.
- **IP binding**: Client keys auto-bind to the first IP used; subsequent requests from unknown IPs require approval.
- **Nonce protection**: Replay attacks are mitigated via short-lived (5-minute) cryptographic nonces.
- **Audit logging**: All authentication and key events are logged with IP, user agent, and timestamp.

---

## Hall of Thanks

*No reports yet — be the first!*
