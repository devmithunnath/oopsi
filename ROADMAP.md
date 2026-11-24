# Oopsi Roadmap

## v0.1 (Current — Core Foundation)
- [x] `@oopsi/worker` — Workers + D1 + private R2 attachments + built-in `/admin` inbox
- [x] Pluggable notifiers (Discord, Slack, Telegram, generic webhook) + Resend email adapter + `verifyCustomer` hook
- [x] `@oopsi/client` — Zero-dependency universal JS/TS client
- [x] `@oopsi/react` — Drop-in `<SupportForm />` & `<TicketThread />` components
- [x] `Oopsi` Swift Package — Native macOS / iOS client, `DiagnosticsRedactor`, and SwiftUI sheet
- [x] `docs/openapi.yaml` — OpenAPI 3.1 specification

## v0.2 (Next — Email & Anti-Abuse)
- [ ] **Cloudflare Email Workers (`email()` export)** — Inbound `support@yourdomain.com` creates tickets & threads `[PREFIX-1001]` replies straight into D1
- [ ] **Cloudflare Turnstile** optional verification toggle in `@oopsi/worker` & `<SupportForm />`
- [ ] **Cloudflare Access JWT** auth option for `/admin` alongside `ADMIN_TOKEN`
- [ ] Canned responses / reply macros in `/admin`

## v0.3 (Ecosystem & Community SDKs)
- [ ] Kotlin / Jetpack Compose SDK for Android
- [ ] Flutter / Dart package
- [ ] Additional email adapters (Postmark, AWS SES, Brevo)
- [ ] Localization (`i18n`) support in `@oopsi/react` and `OopsiUI`

*Want to tackle any item above? Open an issue or PR — contributions are welcome!*
