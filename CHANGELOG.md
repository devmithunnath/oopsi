# Changelog

All notable changes to **Oopsi** will be documented in this file.

## [0.1.0] - 2026-11-24

### Added
- **`@oopsi/worker`**: Cloudflare Worker factory (`createSupportWorker`), D1 SQLite migrations, private R2 attachment upload & XSS-sandboxed streaming, hashed-IP rate limiting, honeypot protection, built-in `/admin` Support Inbox UI, optional `verifyCustomer` billing hook, and built-in Discord, Slack, Telegram, generic webhook, and Resend email adapters.
- **`@oopsi/client`**: Zero-dependency TypeScript/JavaScript SDK for browsers, React Native, Expo, Electron, and Node.
- **`@oopsi/react`**: Themeable `<SupportForm />` and `<TicketThread />` React components for Cloudflare Pages and modern React apps.
- **`Oopsi` Swift Package**: Zero-dependency Swift 6 `Sendable` client (`OopsiClient`), `DiagnosticsRedactor`, and native SwiftUI `OopsiSupportSheet` for macOS 14+ and iOS 17+.
- **`docs/openapi.yaml`**: OpenAPI 3.1 specification for generating clients in Kotlin, Dart/Flutter, Go, Python, and more.
- **`examples/cloudflare-worker`**: Ready-to-deploy starter template.
