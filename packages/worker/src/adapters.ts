import type {
  NotifierEvent,
  OutboundEmail,
  SupportEmailAdapter,
  SupportNotifier,
  SupportWorkerEnv,
} from "./types.ts";

function snippet(text: string, max = 280): string {
  const cleaned = text.trim().replace(/\s+/g, " ");
  return cleaned.length > max ? `${cleaned.slice(0, max - 1)}…` : cleaned;
}

export function discordNotifier(webhookEnvKey = "SUPPORT_NOTIFY_WEBHOOK"): SupportNotifier {
  return {
    name: "discord",
    async send(event: NotifierEvent, env: SupportWorkerEnv, fetcher: typeof fetch): Promise<void> {
      const url = String(env[webhookEnvKey] ?? "").trim();
      if (!url) return;
      const isNew = event.type === "ticket.created";
      const badge = event.ticket.customer_verified ? ` · ✓ ${event.ticket.customer_badge || "Verified"}` : "";
      await fetcher(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          embeds: [
            {
              title: `${isNew ? "New ticket" : "Customer reply"} · ${event.ticket.ticket_code}`,
              description: `**${event.ticket.subject}**\n${snippet(event.messageBody)}`,
              color: isNew ? 0xff6b4a : 0x34d399,
              fields: [
                { name: "Customer", value: `${event.ticket.customer_name} (${event.ticket.customer_email})${badge}`, inline: false },
                { name: "Category / Source", value: `${event.ticket.category} · ${event.ticket.source}`, inline: true },
                { name: "Admin Inbox", value: `[Open in /admin](${event.adminUrl})`, inline: true },
              ],
            },
          ],
        }),
      });
    },
  };
}

export function slackNotifier(webhookEnvKey = "SUPPORT_NOTIFY_WEBHOOK"): SupportNotifier {
  return {
    name: "slack",
    async send(event: NotifierEvent, env: SupportWorkerEnv, fetcher: typeof fetch): Promise<void> {
      const url = String(env[webhookEnvKey] ?? "").trim();
      if (!url) return;
      const title = event.type === "ticket.created" ? "New support ticket" : "Customer reply";
      await fetcher(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: `[${event.ticket.ticket_code}] ${title}: ${event.ticket.subject} (${event.ticket.customer_email}) — ${snippet(event.messageBody)} | ${event.adminUrl}`,
        }),
      });
    },
  };
}

export function telegramNotifier(): SupportNotifier {
  return {
    name: "telegram",
    async send(event: NotifierEvent, env: SupportWorkerEnv, fetcher: typeof fetch): Promise<void> {
      const botToken = String(env.TELEGRAM_BOT_TOKEN ?? "").trim();
      const chatId = String(env.TELEGRAM_CHAT_ID ?? "").trim();
      if (!botToken || !chatId) return;
      const heading = event.type === "ticket.created" ? "New ticket" : "Reply";
      const text = [
        `${heading} [${event.ticket.ticket_code}] — ${event.ticket.subject}`,
        `From: ${event.ticket.customer_name} <${event.ticket.customer_email}>`,
        snippet(event.messageBody),
        `Admin: ${event.adminUrl}`,
      ].join("\n");
      await fetcher(`https://api.telegram.org/bot${encodeURIComponent(botToken)}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text }),
      });
    },
  };
}

export function webhookNotifier(webhookEnvKey = "SUPPORT_NOTIFY_WEBHOOK"): SupportNotifier {
  return {
    name: "webhook",
    async send(event: NotifierEvent, env: SupportWorkerEnv, fetcher: typeof fetch): Promise<void> {
      const url = String(env[webhookEnvKey] ?? "").trim();
      if (!url) return;
      await fetcher(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(event),
      });
    },
  };
}

export function resendEmailAdapter(options: {
  from: string;
  replyTo?: string;
  apiKeyEnvKey?: string;
}): SupportEmailAdapter {
  const apiKeyEnvKey = options.apiKeyEnvKey ?? "RESEND_API_KEY";
  return {
    name: "resend",
    async send(email: OutboundEmail, env: SupportWorkerEnv, fetcher: typeof fetch): Promise<void> {
      const apiKey = String(env[apiKeyEnvKey] ?? "").trim();
      if (!apiKey) return;
      await fetcher("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: options.from,
          to: [email.to],
          subject: email.subject,
          text: email.text,
          html: email.html,
          reply_to: email.replyTo ?? options.replyTo,
        }),
      });
    },
  };
}
