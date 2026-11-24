# Set Up Oopsi with Any AI Coding Agent

You don't need to configure Cloudflare D1, R2, Wrangler, email adapters, or SDKs manually. Copy any prompt below and paste it into **Antigravity**, **Claude Code**, **Cursor**, **OpenAI Codex**, **Windsurf**, **Gemini CLI**, or **GitHub Copilot**.

> **Security rule built into every prompt:** Your AI agent will run `wrangler` commands for you, and will pause and tell you to run `npx wrangler secret put ...` directly in your own terminal so your `ADMIN_TOKEN`, `RESEND_API_KEY`, or webhook URLs **never** enter an AI chat log or Git commit.

---

## 1. Master Prompt — Full End-to-End Setup (Backend + Client SDK + Alerts)

Copy and paste this into your AI coding agent inside **your own app repository**:

```text
Set up Oopsi (https://github.com/devmithunnath/oopsi) as the $0/month Cloudflare-native support desk for this project.

Read https://raw.githubusercontent.com/devmithunnath/oopsi/main/llms.txt (or inspect the oopsi repo) first so you use the exact package APIs, D1 schema, R2 bindings, and OpenAPI contract.

Before writing code, ask me these 4 short questions:
1. Brand name & 3-letter ticket prefix (e.g. "MyApp" / "APP")
2. Which client(s) to wire up: Web/Cloudflare Pages (@oopsi/react), JS/React Native/Electron (@oopsi/client), macOS/iOS (Oopsi Swift Package), or Android/Flutter (via docs/openapi.yaml)?
3. Do I want instant notifications (Discord / Slack / Telegram) or outbound emails (Resend)?
4. What is my production site URL / allowed CORS origin?

Then perform these steps in order:
1. Check `npx wrangler whoami`. If not signed in, ask me to run `npx wrangler login` and wait.
2. Scaffold `workers/support/` using `@oopsi/worker` (following examples/cloudflare-worker):
   - Create a Cloudflare D1 database (`<app>-support`) and private R2 bucket (`<app>-support-attachments`) for screenshots & diagnostic logs.
   - Copy `packages/worker/migrations/0001_init.sql` into `workers/support/migrations/` and apply it to remote D1 (`--remote`).
   - Configure `createSupportWorker(...)` with my brandName, ticketPrefix, portalBaseUrl, allowedOrigins, and chosen notifier/email adapters.
   - Deploy with `npx wrangler deploy` and verify `GET /health` and `GET /admin` return HTTP 200.
3. NEVER ask me to paste secret values into chat. Give me the exact terminal commands to set secrets directly:
   - `openssl rand -hex 32` -> `npx wrangler secret put ADMIN_TOKEN`
   - Optional: `npx wrangler secret put SUPPORT_NOTIFY_WEBHOOK` (Discord/Slack/webhook)
   - Optional: `npx wrangler secret put RESEND_API_KEY` (Resend outbound email)
4. Wire my chosen client SDK into this repo:
   - Web (React / Cloudflare Pages): add `/support` (`<SupportForm />`) and `/support/ticket` (`<TicketThread />`) from `@oopsi/react`, themed with CSS variables matching this project's existing palette and linked from the footer/nav.
   - macOS / iOS (Swift): add the `Oopsi` Swift Package (`swift/`), wire `Help → Contact Support…` to `OopsiSupportSheet` with opt-in `DiagnosticsRedactor`, and verify builds & tests pass.
   - React Native / Electron / Node: install `@oopsi/client` and add a typed support submission helper.
   - Android / Flutter / Other: generate or implement a typed client against `docs/openapi.yaml`.
5. Run typecheck/tests/build and finish with a 30-second smoke test checklist so I can submit a real ticket and view it in `/admin`.
```

---

## 2. Targeted Prompts (Pick Only What You Need)

### A. Cloudflare Backend Only (Workers + D1 + R2 + `/admin` Inbox)

```text
Add an Oopsi support backend to this repository under `workers/support/` using `@oopsi/worker` (see https://github.com/devmithunnath/oopsi/blob/main/docs/self-hosting.md).
- Create Cloudflare D1 database `<my-app>-support` and private R2 bucket `<my-app>-support-attachments`.
- Apply `0001_init.sql` migration to remote D1.
- Configure `createSupportWorker({ brandName, ticketPrefix, portalBaseUrl, allowedOrigins })`.
- Deploy with `npx wrangler deploy`, verify `/health` and `/admin` return 200, and give me the exact `npx wrangler secret put ADMIN_TOKEN` command to run locally (do not ask me to paste secrets in chat).
```

### B. Web / Cloudflare Pages UI (`@oopsi/react`)

```text
Add `/support` and `/support/ticket` pages to our web app using `@oopsi/react` (`<SupportForm />` and `<TicketThread />`) pointing at `<YOUR_OOPSI_WORKER_URL>`.
- Import `@oopsi/react/styles.css` and override `.oopsi-root` CSS variables (`--oopsi-bg`, `--oopsi-surface`, `--oopsi-border`, `--oopsi-accent`, `--oopsi-success`) so the form and ticket thread match our site's existing design system.
- Link `/support` in our site navigation/footer.
- Ensure SPA fallback works on Cloudflare Pages (note: do NOT add an infinite-loop `/* /index.html 200` rule in `_redirects` — Cloudflare Pages handles SPA fallback automatically when there is no `404.html`).
- Build and verify zero console errors and zero horizontal overflow on desktop and mobile.
```

### C. macOS / iOS App (`Oopsi` Swift Package)

```text
Integrate the Oopsi Swift Package (`https://github.com/devmithunnath/oopsi`, package directory `swift/`) into our Apple app pointing at `<YOUR_OOPSI_WORKER_URL>`.
- Wire `Help → Contact Support…` (macOS) or Settings → Support (iOS) to `OopsiSupportSheet` using `OopsiClient`.
- Keep diagnostic log attachment explicitly opt-in and pass all logs through `DiagnosticsRedactor.redact(_:)` so usernames, API keys, bearer tokens, and license keys are scrubbed before leaving the device.
- Add a unit test verifying redaction and ticket submission, and run `xcodebuild test` / `swift test`.
```

### D. Mobile / Android / Flutter / React Native

```text
Integrate Oopsi support ticketing into our mobile app using `<YOUR_OOPSI_WORKER_URL>`:
- If React Native / Expo: install `@oopsi/client`, build a native Support screen calling `client.createTicket(...)` with `source: Platform.OS` and optional screenshot/log attachment, and display the returned `ticket_code` + `ticket_url`.
- If Android (Kotlin) or Flutter (Dart): fetch https://raw.githubusercontent.com/devmithunnath/oopsi/main/docs/openapi.yaml and generate/implement a typed client for `POST /api/tickets` (JSON & multipart), `GET /api/tickets/{access_token}`, and `POST /api/tickets/{access_token}/messages`.
```

### E. Email & Instant Founder Alerts (Discord, Slack, Telegram, Resend)

```text
Configure notifications and outbound email on our Oopsi Worker in `workers/support/src/index.ts` (see https://github.com/devmithunnath/oopsi/blob/main/docs/adapters.md):
- Add `discordNotifier()` (or `slackNotifier()` / `telegramNotifier()`) to `notifiers`.
- Add `resendEmailAdapter({ from: "<Brand> Support <support@yourdomain.com>", replyTo: "support@yourdomain.com" })` to `email`.
- Redeploy with `npx wrangler deploy`.
- Give me the exact terminal commands (`npx wrangler secret put SUPPORT_NOTIFY_WEBHOOK` and `npx wrangler secret put RESEND_API_KEY`) and DNS steps (SPF/DKIM in Resend) without asking me to paste secret keys into chat.
```

### F. Verified Customer Badge (Dodo Payments / Stripe / Lemon Squeezy)

```text
Add a `verifyCustomer` callback to our Oopsi Worker (`workers/support/src/index.ts`) so paying customers automatically get a "Verified Customer" badge in `/admin`.
- Read customer status from our existing D1 sales table (or Dodo Payments / Stripe API via secret env binding).
- Never fail or block ticket submission if the billing check times out — return `{ verified: false }` on errors.
- Add a unit test with `MemorySupportStorage` verifying both verified and unverified customers.
```

---

## 3. Tool-Specific Quick Tips

| AI Coding Agent | Fastest Way to Use Oopsi |
|---|---|
| **Antigravity** | Copy the Master Prompt above, OR copy [`skills/oopsi-setup/SKILL.md`](../skills/oopsi-setup/SKILL.md) into your workspace `.agents/skills/oopsi-setup/SKILL.md` and ask: *"Set up Oopsi support desk for this project."* |
| **Claude Code** | Run `claude` in your repo root and paste the Master Prompt above (or save `skills/oopsi-setup/SKILL.md` to `.claude/skills/oopsi-setup/SKILL.md`). |
| **Cursor** | Open Agent/Composer (`Cmd+I`), add `@https://raw.githubusercontent.com/devmithunnath/oopsi/main/llms.txt` as context, and paste the Master Prompt. |
| **OpenAI Codex CLI** | Run `codex` in your repo and paste the Master Prompt above (Codex also discovers `skills/oopsi-setup/SKILL.md`). |
| **Gemini CLI** | Run `gemini` in your repo and paste the Master Prompt above. |
| **Windsurf / Copilot** | Paste the Master Prompt into Cascade / Copilot Agent mode and confirm each `wrangler` step. |
