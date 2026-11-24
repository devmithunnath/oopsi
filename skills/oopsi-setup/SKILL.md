---
name: oopsi-setup
description: Install, configure, and deploy Oopsi — a $0/month Cloudflare Workers + D1 + R2 support desk with built-in /admin inbox, Discord/Slack/Resend adapters, React UI, Swift Package (macOS/iOS), and OpenAPI 3.1 clients. Use when onboarding a new project onto Oopsi.
---

# Oopsi Setup Skill

Use this procedure whenever a developer asks you to set up **Oopsi** (`https://github.com/devmithunnath/oopsi`) in their project.

## Strict Security Rules

1. **Never ask the user to paste secret values** (`ADMIN_TOKEN`, `RESEND_API_KEY`, `SUPPORT_NOTIFY_WEBHOOK`, `TELEGRAM_BOT_TOKEN`) into chat.
2. Always give the user the exact `npx wrangler secret put <NAME>` command to run in their own terminal.
3. Never commit secrets, `.dev.vars`, or raw user logs to Git.
4. For desktop/mobile diagnostics, always keep log attachments **opt-in** and run them through `DiagnosticsRedactor.redact(_:)` (or equivalent PII scrubber).

## Step 1 — Gather 4 Preferences

Ask the user (in one concise turn) if not already stated:
1. **Brand name & 3-letter ticket prefix** (e.g. `MyApp` / `APP` → `APP-1001`).
2. **Client surface(s) to wire:** Web/Cloudflare Pages (`@oopsi/react`), JS/RN/Electron (`@oopsi/client`), macOS/iOS (`Oopsi` Swift Package), or Android/Flutter (`docs/openapi.yaml`).
3. **Optional alerts/email:** Discord, Slack, Telegram, generic webhook, and/or Resend outbound email.
4. **Allowed production origin(s)** for CORS (e.g. `https://myapp.pages.dev`, `https://myapp.com`).

## Step 2 — Provision & Deploy Cloudflare Worker

1. Verify Wrangler auth: `npx wrangler whoami`. If unauthenticated, instruct the user to run `npx wrangler login` and wait.
2. Create `workers/support/` using `@oopsi/worker` (mirroring `examples/cloudflare-worker`):
   - `wrangler.toml` with `[[d1_databases]]` (`binding = "DB"`) and `[[r2_buckets]]` (`binding = "ATTACHMENTS_BUCKET"`).
   - `migrations/0001_init.sql` copied from `@oopsi/worker/migrations/0001_init.sql`.
   - `src/index.ts` calling `createSupportWorker({ brandName, ticketPrefix, portalBaseUrl, allowedOrigins, notifiers, email, verifyCustomer })`.
3. Create remote resources:
   - `npx wrangler d1 create <app>-support` → put returned `database_id` into `wrangler.toml`.
   - `npx wrangler r2 bucket create <app>-support-attachments` → put bucket name into `wrangler.toml`.
4. Apply D1 schema migration:
   - `npx wrangler d1 migrations apply <app>-support --remote -y`
5. Deploy Worker:
   - `npx wrangler deploy`
6. Verify live:
   - `curl -sS https://<worker-url>/health` returns `{"ok":true,"service":"oopsi-worker",...}`
   - `curl -sS -o /dev/null -w "%{http_code}" https://<worker-url>/admin` returns `200`

## Step 3 — Guide User Through Secrets

Provide the exact commands for the user to run locally:

```bash
cd workers/support
openssl rand -hex 32   # Save this in your password manager, then paste below:
npx wrangler secret put ADMIN_TOKEN
```

If alerts or email were requested, also include:
- Discord / Slack / Webhook: `npx wrangler secret put SUPPORT_NOTIFY_WEBHOOK`
- Telegram: `npx wrangler secret put TELEGRAM_BOT_TOKEN` and `npx wrangler secret put TELEGRAM_CHAT_ID`
- Resend email: `npx wrangler secret put RESEND_API_KEY` (remind user to verify their sending domain's SPF/DKIM records in Resend)

## Step 4 — Wire Client SDK(s)

- **Web / Cloudflare Pages (`@oopsi/react`):**
  - Install `@oopsi/react` and `@oopsi/client`.
  - Add `/support` (`<SupportForm apiUrl="..." />`) and `/support/ticket` (`<TicketThread apiUrl="..." accessToken={...} />`).
  - Import `@oopsi/react/styles.css` and override `.oopsi-root` CSS variables to match the app's existing palette.
  - Link `/support` in the app's footer/nav.
  - Note for Cloudflare Pages SPA routing: do **not** create a `/* /index.html 200` `_redirects` rule (Cloudflare throws error `100324` infinite loop); Cloudflare Pages automatically serves `index.html` for unknown routes when no `404.html` exists.
- **macOS / iOS (`Oopsi` Swift Package):**
  - Add `https://github.com/devmithunnath/oopsi` (`swift/`) via Swift Package Manager.
  - Wire `OopsiSupportSheet` + `OopsiClient` with opt-in `DiagnosticsRedactor`.
- **Android / Flutter / Other:**
  - Use `docs/openapi.yaml` (`POST /api/tickets`, `GET /api/tickets/{access_token}`, `POST /api/tickets/{access_token}/messages`).

## Step 5 — Verify End-to-End

1. Run build, typecheck, and unit tests for both the Worker and the client app.
2. Provide a 30-second verification checklist: submit a test ticket on `/support` (or from the app), verify ticket code + private tracking URL appear, open `https://<worker-url>/admin` with `ADMIN_TOKEN`, post a reply, and confirm the reply appears on `/support/ticket?t=...`.
