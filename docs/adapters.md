# Adapters & Custom Integrations

Oopsi keeps its core zero-dependency and lets you plug in notifications, email providers, and customer verification hooks in a few lines of TypeScript.

## Built-In Notifiers

```ts
import {
  createSupportWorker,
  discordNotifier,
  slackNotifier,
  telegramNotifier,
  webhookNotifier,
} from "@oopsi/worker";

export default createSupportWorker({
  brandName: "MyApp",
  notifiers: [discordNotifier()], // Reads env.SUPPORT_NOTIFY_WEBHOOK
});
```

## Outbound Email (Resend or Custom)

```ts
import { createSupportWorker, resendEmailAdapter } from "@oopsi/worker";

export default createSupportWorker({
  brandName: "MyApp",
  email: resendEmailAdapter({
    from: "MyApp Support <support@myapp.com>",
    replyTo: "support@myapp.com",
  }),
});
```

To plug in Postmark, SES, or Brevo, implement `SupportEmailAdapter`:

```ts
const myEmailAdapter = {
  name: "postmark",
  async send(email, env, fetcher) {
    await fetcher("https://api.postmarkapp.com/email", {
      method: "POST",
      headers: {
        "X-Postmark-Server-Token": String(env.POSTMARK_TOKEN),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        From: "support@myapp.com",
        To: email.to,
        Subject: email.subject,
        TextBody: email.text,
      }),
    });
  },
};
```

## Billing / Verified Customer Hook (`verifyCustomer`)

Display a **✓ Verified Customer** (or **Founding 100**, **Pro Plan**, etc.) badge inside `/admin` by passing `verifyCustomer`:

```ts
verifyCustomer: async ({ email, env }) => {
  // Query your D1 sales table, Dodo Payments, Stripe, or Lemon Squeezy
  const row = await env.BILLING_DB.prepare(
    "SELECT 1 FROM checkout_claims WHERE LOWER(customer_email) = ? AND status = 'succeeded' LIMIT 1",
  ).bind(email.toLowerCase()).first();

  return row ? { verified: true, badge: "Verified Buyer" } : { verified: false };
}
```
