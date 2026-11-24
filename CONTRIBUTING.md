# Contributing to Oopsi

Thanks for your interest in contributing to **Oopsi**! Whether it's a bug fix, a new notification/email adapter, a mobile SDK, or a documentation improvement, PRs are very welcome.

## Local Development

### Prerequisites
- **Node.js 22+** (for native `--experimental-strip-types` test runner)
- **Swift 6 / Xcode 16+** (only if working on `swift/`)

### Setup & Tests

```bash
git clone https://github.com/devmithunnath/oopsi.git
cd oopsi
npm install

# Run all workspace typechecks, tests, and builds
npm run typecheck
npm test
npm run build
```

For the Swift Package:

```bash
cd swift
swift test
```

## Repo Layout

- `packages/worker` — Core Cloudflare Worker (`@oopsi/worker`), D1 migrations, R2 streaming, `/admin` UI, and adapters.
- `packages/client` — Zero-dependency universal JS/TS client (`@oopsi/client`).
- `packages/react` — Drop-in React components (`@oopsi/react`).
- `swift/` — Native Apple Swift Package (`OopsiClient` + `OopsiUI`).
- `examples/cloudflare-worker` — Starter deployment template.
- `docs/openapi.yaml` — OpenAPI 3.1 contract (keep this in sync when changing any HTTP endpoint!).

## Good First Contributions

- New **Email Adapters** (Postmark, AWS SES, Brevo, Mailgun) in `packages/worker/src/adapters.ts`.
- New **Client SDKs** generated or hand-crafted from `docs/openapi.yaml` (Kotlin/Android, Flutter/Dart, Electron).
- **Cloudflare Turnstile** verification middleware for public web forms.
- **Cloudflare Email Workers** inbound email-to-ticket handler (`email()` export).
- Accessibility & localization improvements in `@oopsi/react` and `OopsiUI`.

## PR Guidelines

1. Keep runtime dependencies at **zero** in `@oopsi/worker`, `@oopsi/client`, and `OopsiClient` (Swift).
2. Add or update unit tests for every behavior change (`MemorySupportStorage` makes Worker tests instant with no Cloudflare account needed).
3. Update `docs/openapi.yaml` if any route or payload schema changes.
4. Keep changes focused and explain the *why* in your PR description.
