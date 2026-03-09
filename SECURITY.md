# Security Policy

## Reporting a Vulnerability

**Please do not report security vulnerabilities through public GitHub issues.**

If you discover a security vulnerability in HeySummon, please report it via email:

📧 **security@heysummon.ai**

Include the following in your report:

- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Any suggested mitigations (optional)

### Response Timeline

| Stage | Target |
|---|---|
| Acknowledgment | Within **48 hours** |
| Initial assessment | Within **7 days** |
| Fix or mitigation | Depends on severity (see below) |
| Public disclosure | After fix is deployed |

### Severity & Resolution Timeline

| Severity | Examples | Target fix time |
|---|---|---|
| Critical | Auth bypass, RCE, data exfiltration | 24–48 hours |
| High | Privilege escalation, key leakage | 3–7 days |
| Medium | CSRF, limited data exposure | 14 days |
| Low | Information disclosure, minor issues | 30 days |

---

## Supported Versions

| Version | Supported |
|---|---|
| `main` branch (latest) | ✅ Yes |
| Previous releases | ❌ No — please update |

Only the latest release receives security patches. We recommend always running the latest version.

---

## Responsible Disclosure

We follow **coordinated disclosure**:

1. You report the vulnerability to us privately
2. We confirm receipt within 48 hours
3. We investigate and develop a fix
4. We notify you when the fix is deployed
5. You may publish your findings after 90 days **or** after the fix is public — whichever comes first

We will not take legal action against researchers who:
- Report vulnerabilities in good faith
- Do not access, modify, or exfiltrate user data beyond what's needed to demonstrate the vulnerability
- Do not perform denial-of-service attacks
- Do not publicly disclose before the fix is deployed

---

## Recognition

We credit security researchers in our release notes and README unless they prefer to remain anonymous. There is currently no monetary bug bounty program, but we're happy to acknowledge your contribution publicly.

---

## Scope

### In scope
- `heysummon` web application (dashboard, API)
- `heysummon` CLI (`npm i -g heysummon`)
- Authentication and session management
- API key validation and rate limiting
- Encryption and key exchange
- Provider/consumer message routing

### Out of scope
- Third-party services (Telegram, email providers, etc.)
- Social engineering attacks
- Physical access attacks
- Issues already reported or known

---

## Contact

For non-security questions, please use [GitHub Issues](https://github.com/thomasansems/heysummon/issues).

For security issues: **security@heysummon.ai**
