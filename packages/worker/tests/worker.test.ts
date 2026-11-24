import assert from "node:assert/strict";
import test from "node:test";
import { discordNotifier, resendEmailAdapter } from "../src/adapters.ts";
import { handleSupportRequest } from "../src/index.ts";
import { MemorySupportStorage } from "../src/storage.ts";
import type { SupportWorkerConfig, SupportWorkerEnv } from "../src/types.ts";

const ADMIN_TOKEN = "oopsi_test_admin_secret";

function makeEnv(r2Map = new Map<string, Uint8Array>()): SupportWorkerEnv {
  const bucket = {
    async put(key: string, value: ArrayBuffer | Uint8Array) {
      const bytes = value instanceof Uint8Array ? value : new Uint8Array(value);
      r2Map.set(key, bytes);
    },
    async get(key: string) {
      const bytes = r2Map.get(key);
      if (!bytes) return null;
      return {
        size: bytes.byteLength,
        body: new ReadableStream({
          start(c) {
            c.enqueue(bytes);
            c.close();
          },
        }),
      };
    },
  } as unknown as R2Bucket;

  return {
    DB: {} as D1Database,
    ATTACHMENTS_BUCKET: bucket,
    ADMIN_TOKEN,
    SUPPORT_NOTIFY_WEBHOOK: "https://discord.example/webhook",
    RESEND_API_KEY: "re_test_123",
  };
}

function makeConfig(): SupportWorkerConfig {
  return {
    brandName: "Ugli",
    ticketPrefix: "UGL",
    portalBaseUrl: "https://ugli-site.pages.dev/support",
    allowedOrigins: ["https://ugli-site.pages.dev"],
    rateLimitPerHour: 3,
    notifiers: [discordNotifier()],
    email: resendEmailAdapter({ from: "Ugli Support <support@ugli.app>" }),
    verifyCustomer: ({ email }) =>
      email.toLowerCase() === "vip@ugli.app"
        ? { verified: true, badge: "Founding 100" }
        : { verified: false },
  };
}

test("full lifecycle: create ticket with R2 attachment, verify badge, isolate internal notes, reply & reopen", async () => {
  const storage = new MemorySupportStorage();
  const r2Map = new Map<string, Uint8Array>();
  const env = makeEnv(r2Map);
  const config = makeConfig();
  const outboundCalls: Array<{ url: string; body: string }> = [];
  const fetcher: typeof fetch = async (input, init) => {
    outboundCalls.push({ url: String(input), body: String(init?.body ?? "") });
    return new Response("{}", { status: 200 });
  };

  // Multipart submission with diagnostic text attachment
  const form = new FormData();
  form.set("name", "Jane Creator");
  form.set("email", "vip@ugli.app");
  form.set("category", "bug");
  form.set("source", "macos");
  form.set("subject", "Export stalled on 4K clip");
  form.set("message", "Stuck at 92% on macOS 26.");
  form.set("metadata", JSON.stringify({ app_version: "1.0.0", macos: "26.1" }));
  form.set("attachment", new File(["redacted log line 1"], "diag.log", { type: "text/plain" }));

  const createRes = await handleSupportRequest(
    new Request("https://support.ugli.app/api/tickets", {
      method: "POST",
      headers: { "CF-Connecting-IP": "1.2.3.4", Origin: "https://ugli-site.pages.dev" },
      body: form,
    }),
    env,
    config,
    { storage, fetcher },
  );
  assert.equal(createRes.status, 201);
  const created = (await createRes.json()) as {
    ticket_code: string;
    access_token: string;
    attachments: Array<{ id: string; download_url: string }>;
  };
  assert.equal(created.ticket_code, "UGL-1001");
  assert.equal(created.attachments.length, 1);
  assert.equal(outboundCalls.length, 2); // Discord + Resend confirmation

  // Attachment download enforces token & sets XSS sandbox headers
  const unauthAtt = await handleSupportRequest(
    new Request(`https://support.ugli.app/api/attachments/${created.attachments[0].id}`),
    env,
    config,
    { storage },
  );
  assert.equal(unauthAtt.status, 403);

  const okAtt = await handleSupportRequest(new Request(created.attachments[0].download_url), env, config, { storage });
  assert.equal(okAtt.status, 200);
  assert.equal(okAtt.headers.get("X-Content-Type-Options"), "nosniff");
  assert.equal(okAtt.headers.get("Content-Security-Policy"), "default-src 'none'; sandbox");
  assert.equal(await okAtt.text(), "redacted log line 1");

  // Admin inspects ticket, sees verified badge, posts private internal note + public reply
  const adminGet = await handleSupportRequest(
    new Request("https://support.ugli.app/admin/api/tickets/UGL-1001", {
      headers: { Authorization: `Bearer ${ADMIN_TOKEN}` },
    }),
    env,
    config,
    { storage },
  );
  assert.equal(adminGet.status, 200);
  const adminDetail = (await adminGet.json()) as { ticket: { customer_verified: boolean; customer_badge: string } };
  assert.equal(adminDetail.ticket.customer_verified, true);
  assert.equal(adminDetail.ticket.customer_badge, "Founding 100");

  await handleSupportRequest(
    new Request("https://support.ugli.app/admin/api/tickets/UGL-1001/reply", {
      method: "POST",
      headers: { Authorization: `Bearer ${ADMIN_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({ body: "SECRET INTERNAL NOTE", internal: true }),
    }),
    env,
    config,
    { storage, fetcher },
  );

  await handleSupportRequest(
    new Request("https://support.ugli.app/admin/api/tickets/UGL-1001/reply", {
      method: "POST",
      headers: { Authorization: `Bearer ${ADMIN_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({ body: "Fixed in v1.0.1 — please update!", internal: false }),
    }),
    env,
    config,
    { storage, fetcher },
  );

  // Customer view must NOT see internal note, sees status waiting_on_customer
  const pubGet = await handleSupportRequest(
    new Request(`https://support.ugli.app/api/tickets/${created.access_token}`),
    env,
    config,
    { storage },
  );
  assert.equal(pubGet.status, 200);
  const pubJson = (await pubGet.json()) as {
    ticket: { status: string };
    messages: Array<{ body: string; sender_type: string }>;
  };
  assert.equal(pubJson.ticket.status, "waiting_on_customer");
  assert.equal(pubJson.messages.length, 2);
  assert.ok(!pubJson.messages.some((m) => m.body.includes("SECRET INTERNAL NOTE")));

  // Customer reply reopens ticket to open
  const custReply = await handleSupportRequest(
    new Request(`https://support.ugli.app/api/tickets/${created.access_token}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "Confirmed fixed, thank you!" }),
    }),
    env,
    config,
    { storage, fetcher },
  );
  assert.equal(custReply.status, 201);
  assert.equal(((await custReply.json()) as { status: string }).status, "open");
});

test("rate limiting, honeypot, and disallowed file extensions are enforced", async () => {
  const storage = new MemorySupportStorage();
  const env = makeEnv();
  const config = makeConfig();

  // Honeypot silently accepts without storing
  const spamRes = await handleSupportRequest(
    new Request("https://support.ugli.app/api/tickets", {
      method: "POST",
      headers: { "Content-Type": "application/json", "CF-Connecting-IP": "9.9.9.9" },
      body: JSON.stringify({ email: "bot@spam.test", subject: "Buy SEO", message: "Spam", website: "http://spam.test" }),
    }),
    env,
    config,
    { storage },
  );
  assert.equal(spamRes.status, 201);
  assert.equal((await storage.listTickets({ status: "all" })).length, 0);

  // Disallowed executable/HTML extension rejected
  const badForm = new FormData();
  badForm.set("email", "user@example.com");
  badForm.set("subject", "XSS attempt");
  badForm.set("message", "See attached");
  badForm.set("attachment", new File(["<script>alert(1)</script>"], "evil.html", { type: "text/html" }));
  const badRes = await handleSupportRequest(
    new Request("https://support.ugli.app/api/tickets", {
      method: "POST",
      headers: { "CF-Connecting-IP": "8.8.8.8" },
      body: badForm,
    }),
    env,
    config,
    { storage },
  );
  assert.equal(badRes.status, 400);

  // Rate limit triggers after 3 requests from same IP
  for (let i = 0; i < 3; i++) {
    const res = await handleSupportRequest(
      new Request("https://support.ugli.app/api/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json", "CF-Connecting-IP": "5.5.5.5" },
        body: JSON.stringify({ email: "a@b.com", subject: `Issue ${i}`, message: "Details" }),
      }),
      env,
      config,
      { storage },
    );
    assert.equal(res.status, 201);
  }
  const blocked = await handleSupportRequest(
    new Request("https://support.ugli.app/api/tickets", {
      method: "POST",
      headers: { "Content-Type": "application/json", "CF-Connecting-IP": "5.5.5.5" },
      body: JSON.stringify({ email: "a@b.com", subject: "Issue 4", message: "Details" }),
    }),
    env,
    config,
    { storage },
  );
  assert.equal(blocked.status, 429);
});
