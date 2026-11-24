# Self-Hosting Oopsi on Cloudflare ($0/month)

Oopsi runs 100% on Cloudflare's free tier: **Workers**, **D1 SQLite**, and **R2** (optional for attachments).

## 1. Create D1 Database & Private R2 Bucket

```bash
cd examples/cloudflare-worker
npm install
npx wrangler login

npx wrangler d1 create my-oopsi-db
npx wrangler r2 bucket create my-oopsi-attachments
```

Paste the `database_id` from `d1 create` into `wrangler.toml`.

## 2. Run Migrations

```bash
npx wrangler d1 migrations apply my-oopsi-db --remote
```

## 3. Configure Secrets

Generate a strong admin password (`openssl rand -hex 32`) and save it in Cloudflare Secrets:

```bash
npx wrangler secret put ADMIN_TOKEN
```

Optional secrets for instant alerts and automated emails:

```bash
# Optional: Discord, Slack, or generic webhook URL for instant pings
npx wrangler secret put SUPPORT_NOTIFY_WEBHOOK

# Optional: Resend API key (3,000 free emails/mo) for ticket confirmations & replies
npx wrangler secret put RESEND_API_KEY
```

## 4. Deploy

```bash
npx wrangler deploy
```

Visit `https://<your-worker>.workers.dev/admin` and enter your `ADMIN_TOKEN` to open your Support Inbox!
