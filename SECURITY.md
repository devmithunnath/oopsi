# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in **Oopsi** (for example: auth bypass on `/admin`, attachment XSS, token leakage, or SQL injection), please **do not** open a public GitHub issue.

Instead, report it privately via **GitHub Security Advisories** (`https://github.com/devmithunnath/oopsi/security/advisories/new`). We will acknowledge your report within 48 hours and coordinate a fix and disclosure.

## Built-In Security Guarantees

- **Constant-time token comparison** for `ADMIN_TOKEN` Bearer auth.
- **256-bit random `access_token`** for customer ticket portals (never sequential IDs).
- **Strict XSS isolation for R2 attachments:** every downloaded file is served with `Content-Security-Policy: default-src 'none'; sandbox`, `X-Content-Type-Options: nosniff`, and allowlisted MIME types.
- **Internal notes isolation:** `sender_type = 'internal_note'` messages are filtered out of all customer-facing queries.
- **No raw IP storage:** rate-limit buckets hash client IPs with SHA-256 before writing to D1.
- **Parameterized SQL queries** everywhere in `D1SupportStorage`.
