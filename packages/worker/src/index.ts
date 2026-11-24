import { renderSupportAdminHtml } from "./admin-html.ts";
import {
  attachmentSecurityHeaders,
  constantTimeEqual,
  generateRandomHex,
  hashIdentifier,
  validateAttachmentFile,
} from "./security.ts";
import { D1SupportStorage, type SupportStorage } from "./storage.ts";
import type {
  SupportAttachment,
  SupportTicket,
  SupportWorkerConfig,
  SupportWorkerEnv,
  TicketPriority,
  TicketStatus,
} from "./types.ts";

export * from "./adapters.ts";
export * from "./security.ts";
export * from "./storage.ts";
export * from "./types.ts";

export interface SupportHandlerDeps {
  storage?: SupportStorage;
  fetcher?: typeof fetch;
  now?: () => Date;
  randomHex?: (bytes?: number) => string;
}

const DEFAULT_CATEGORIES = ["bug", "licensing", "billing", "feature", "other"];
const DEFAULT_MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
const DEFAULT_RATE_LIMIT_PER_HOUR = 8;
const VALID_STATUSES = new Set<TicketStatus>(["open", "waiting_on_customer", "resolved", "closed"]);
const VALID_PRIORITIES = new Set<TicketPriority>(["normal", "high", "urgent"]);

function jsonResponse(body: unknown, status = 200, extraHeaders: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...extraHeaders,
    },
  });
}

function buildCorsHeaders(request: Request, config: SupportWorkerConfig, env: SupportWorkerEnv): Record<string, string> {
  const reqOrigin = request.headers.get("Origin")?.trim() ?? "";
  const allowed = config.allowedOrigins && config.allowedOrigins.length > 0 ? config.allowedOrigins : [];
  const envOrigin = typeof env.CORS_ORIGIN === "string" ? env.CORS_ORIGIN.trim() : "";

  let allowOrigin = "*";
  if (allowed.length > 0 && !allowed.includes("*")) {
    if (reqOrigin && allowed.includes(reqOrigin)) {
      allowOrigin = reqOrigin;
    } else if (
      reqOrigin &&
      allowed.some((a) => {
        try {
          const au = new URL(a);
          const ru = new URL(reqOrigin);
          return (
            (au.hostname.endsWith(".pages.dev") && ru.hostname.endsWith(`.${au.hostname}`)) ||
            ru.hostname === "localhost" ||
            ru.hostname === "127.0.0.1"
          );
        } catch {
          return false;
        }
      })
    ) {
      allowOrigin = reqOrigin;
    } else {
      allowOrigin = allowed[0];
    }
  } else if (envOrigin) {
    allowOrigin = envOrigin;
  }

  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "GET, POST, PATCH, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    Vary: "Origin",
  };
}

function isAuthorizedAdmin(request: Request, env: SupportWorkerEnv): boolean {
  const expected = typeof env.ADMIN_TOKEN === "string" ? env.ADMIN_TOKEN.trim() : "";
  if (!expected) return false;
  const auth = request.headers.get("Authorization")?.trim() ?? "";
  if (!auth.startsWith("Bearer ")) return false;
  return constantTimeEqual(auth.slice("Bearer ".length).trim(), expected);
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254;
}

function buildPortalTicketUrl(config: SupportWorkerConfig, origin: string, accessToken: string): string {
  const base = (config.portalBaseUrl?.trim() || `${origin}/support`).replace(/\/+$/, "");
  return `${base}/ticket?t=${encodeURIComponent(accessToken)}`;
}

function sanitizeMetadata(raw: unknown): Record<string, string> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: Record<string, string> = {};
  let count = 0;
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (count >= 16) break;
    const key = k.trim().replace(/[^a-zA-Z0-9_.-]/g, "_").slice(0, 40);
    if (!key || v == null) continue;
    const val = String(v).trim().slice(0, 160);
    if (val) {
      out[key] = val;
      count++;
    }
  }
  return out;
}

function publicTicketShape(
  ticket: SupportTicket,
  origin: string,
  config: SupportWorkerConfig,
  attachments: SupportAttachment[],
) {
  return {
    ticket_code: ticket.ticket_code,
    status: ticket.status,
    category: ticket.category,
    source: ticket.source,
    customer_name: ticket.customer_name,
    subject: ticket.subject,
    created_at: ticket.created_at,
    updated_at: ticket.updated_at,
    ticket_url: buildPortalTicketUrl(config, origin, ticket.access_token),
    attachments: attachments.map((a) => ({
      id: a.id,
      message_id: a.message_id,
      filename: a.filename,
      content_type: a.content_type,
      size_bytes: a.size_bytes,
      download_url: `${origin}/api/attachments/${encodeURIComponent(a.id)}?token=${encodeURIComponent(ticket.access_token)}`,
      created_at: a.created_at,
    })),
  };
}

interface ParsedSubmission {
  name: string;
  email: string;
  category: string;
  source: string;
  subject: string;
  message: string;
  honeypot: string;
  metadata: Record<string, string>;
  attachment: { name: string; bytes: ArrayBuffer } | null;
}

async function parseTicketSubmission(request: Request): Promise<ParsedSubmission | { error: string }> {
  const ct = (request.headers.get("Content-Type") || "").toLowerCase();
  if (ct.includes("multipart/form-data")) {
    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      return { error: "Invalid multipart form data." };
    }
    const str = (key: string) => {
      const v = form.get(key);
      return typeof v === "string" ? v.trim() : "";
    };
    let metadata: Record<string, string> = {};
    const rawMeta = str("metadata");
    if (rawMeta) {
      try {
        metadata = sanitizeMetadata(JSON.parse(rawMeta));
      } catch {
        metadata = {};
      }
    }
    let attachment: { name: string; bytes: ArrayBuffer } | null = null;
    const fileField = form.get("attachment");
    if (fileField && typeof fileField !== "string" && fileField.size > 0) {
      attachment = {
        name: fileField.name || "attachment.bin",
        bytes: await fileField.arrayBuffer(),
      };
    }
    return {
      name: str("name"),
      email: str("email"),
      category: str("category") || "other",
      source: str("source") || "web",
      subject: str("subject"),
      message: str("message"),
      honeypot: str("website") || str("_hp"),
      metadata,
      attachment,
    };
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return { error: "Invalid JSON body." };
  }
  const str = (k: string) => (typeof body[k] === "string" ? String(body[k]).trim() : "");
  return {
    name: str("name"),
    email: str("email"),
    category: str("category") || "other",
    source: str("source") || "web",
    subject: str("subject"),
    message: str("message"),
    honeypot: str("website") || str("_hp"),
    metadata: sanitizeMetadata(body.metadata),
    attachment: null,
  };
}

export async function handleSupportRequest(
  request: Request,
  env: SupportWorkerEnv,
  config: SupportWorkerConfig,
  deps: SupportHandlerDeps = {},
): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/+$/, "") || "/";
  const storage = deps.storage ?? new D1SupportStorage(env.DB);
  const fetcher = deps.fetcher ?? fetch;
  const nowDate = deps.now ? deps.now() : new Date();
  const nowIso = nowDate.toISOString();
  const nowSec = Math.floor(nowDate.getTime() / 1000);
  const randomHex = deps.randomHex ?? generateRandomHex;
  const cors = buildCorsHeaders(request, config, env);

  const ticketPrefix = (config.ticketPrefix || "OPS").toUpperCase().replace(/[^A-Z0-9]/g, "") || "OPS";
  const startingNumber = config.startingTicketNumber ?? 1000;
  const allowedCategories = config.categories?.length ? config.categories : DEFAULT_CATEGORIES;
  const maxAttachmentBytes = config.maxAttachmentBytes ?? DEFAULT_MAX_ATTACHMENT_BYTES;
  const rateLimitPerHour = config.rateLimitPerHour ?? DEFAULT_RATE_LIMIT_PER_HOUR;
  const agentDisplayName = config.agentDisplayName || `${config.brandName} Support`;

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: cors });
  }

  if (path === "/health" && request.method === "GET") {
    return jsonResponse({ ok: true, service: "oopsi-worker", brand: config.brandName }, 200, cors);
  }

  // POST /api/tickets — create a new support ticket (JSON or multipart with attachment)
  if (path === "/api/tickets" && request.method === "POST") {
    const parsed = await parseTicketSubmission(request);
    if ("error" in parsed) {
      return jsonResponse({ error: parsed.error }, 400, cors);
    }

    // Honeypot: silently accept spam without writing to D1.
    if (parsed.honeypot) {
      return jsonResponse({ ticket_code: `${ticketPrefix}-0000`, status: "open" }, 201, cors);
    }

    const clientIp =
      request.headers.get("CF-Connecting-IP") ||
      request.headers.get("X-Forwarded-For")?.split(",")[0]?.trim() ||
      "unknown";
    const rlKey = `create:${await hashIdentifier(clientIp)}`;
    const rl = await storage.checkAndIncrementRateLimit(rlKey, nowSec, 3600, rateLimitPerHour);
    if (!rl.allowed) {
      return jsonResponse(
        { error: "Too many support requests from your network. Please wait a bit and try again." },
        429,
        cors,
      );
    }

    if (!parsed.email || !isValidEmail(parsed.email)) {
      return jsonResponse({ error: "Please enter a valid email address." }, 400, cors);
    }
    if (!parsed.subject || parsed.subject.length > 180) {
      return jsonResponse({ error: "Please enter a subject (1–180 characters)." }, 400, cors);
    }
    if (!parsed.message || parsed.message.length > 10_000) {
      return jsonResponse({ error: "Please describe your issue (1–10,000 characters)." }, 400, cors);
    }

    const name = (parsed.name || parsed.email.split("@")[0] || "Customer").slice(0, 100);
    const category = allowedCategories.includes(parsed.category) ? parsed.category : allowedCategories[0] || "other";
    const source = parsed.source.replace(/[^a-z0-9_-]/gi, "").slice(0, 24) || "web";

    let validatedAtt: { safeName: string; contentType: string } | null = null;
    if (parsed.attachment) {
      if (!env.ATTACHMENTS_BUCKET) {
        return jsonResponse({ error: "Attachment uploads are not enabled on this server." }, 400, cors);
      }
      const check = validateAttachmentFile(parsed.attachment.name, parsed.attachment.bytes.byteLength, maxAttachmentBytes);
      if (!check.ok) {
        return jsonResponse({ error: check.error }, 400, cors);
      }
      validatedAtt = { safeName: check.safeName, contentType: check.contentType };
    }

    let customerVerified = false;
    let customerBadge: string | null = null;
    if (config.verifyCustomer) {
      try {
        const res = await config.verifyCustomer({ email: parsed.email, metadata: parsed.metadata, env });
        customerVerified = Boolean(res.verified);
        customerBadge = res.badge ?? (customerVerified ? "Verified Customer" : null);
      } catch {
        // Never block ticket submission if an optional verification hook fails.
      }
    }

    const accessToken = randomHex(32);
    const { ticket, message } = await storage.createTicket({
      ticketPrefix,
      startingTicketNumber: startingNumber,
      accessToken,
      category,
      source,
      customerName: name,
      customerEmail: parsed.email.toLowerCase(),
      customerVerified,
      customerBadge,
      subject: parsed.subject,
      messageBody: parsed.message,
      metadata: parsed.metadata,
      nowIso,
    });

    const attachments: SupportAttachment[] = [];
    if (parsed.attachment && validatedAtt && env.ATTACHMENTS_BUCKET) {
      const attId = `att_${randomHex(12)}`;
      const r2Key = `tickets/${ticket.ticket_code}/${attId}-${validatedAtt.safeName}`;
      await env.ATTACHMENTS_BUCKET.put(r2Key, parsed.attachment.bytes, {
        httpMetadata: { contentType: validatedAtt.contentType },
      });
      const att: SupportAttachment = {
        id: attId,
        ticket_id: ticket.id,
        message_id: message.id,
        r2_key: r2Key,
        filename: validatedAtt.safeName,
        content_type: validatedAtt.contentType,
        size_bytes: parsed.attachment.bytes.byteLength,
        created_at: nowIso,
      };
      await storage.createAttachment(att);
      attachments.push(att);
    }

    const ticketUrl = buildPortalTicketUrl(config, url.origin, ticket.access_token);
    const adminUrl = `${url.origin}/admin`;

    // Dispatch optional notifiers + customer confirmation email (non-blocking errors).
    if (config.notifiers?.length) {
      await Promise.allSettled(
        config.notifiers.map((n) =>
          n.send({ type: "ticket.created", brandName: config.brandName, ticket, messageBody: parsed.message, adminUrl, ticketUrl }, env, fetcher),
        ),
      );
    }
    if (config.email) {
      await Promise.allSettled([
        config.email.send(
          {
            to: ticket.customer_email,
            subject: `[${ticket.ticket_code}] We received your request: ${ticket.subject}`,
            text: [
              `Hi ${ticket.customer_name},`,
              "",
              `Thanks for reaching out to ${config.brandName}. We received your support request (${ticket.ticket_code}) and will reply shortly.`,
              "",
              `Track status or add a reply anytime here:`,
              ticketUrl,
            ].join("\n"),
          },
          env,
          fetcher,
        ),
      ]);
    }

    return jsonResponse(
      {
        ticket_code: ticket.ticket_code,
        access_token: ticket.access_token,
        ticket_url: ticketUrl,
        status: ticket.status,
        attachments: publicTicketShape(ticket, url.origin, config, attachments).attachments,
      },
      201,
      { ...cors, "Cache-Control": "no-store" },
    );
  }

  // GET /api/tickets/:access_token — public ticket status & thread
  const ticketMatch = path.match(/^\/api\/tickets\/([a-f0-9-]{16,128})$/i);
  if (ticketMatch && request.method === "GET") {
    const ticket = await storage.getTicketByAccessToken(ticketMatch[1]);
    if (!ticket) {
      return jsonResponse({ error: "Ticket not found." }, 404, { ...cors, "Cache-Control": "no-store" });
    }
    const [messages, attachments] = await Promise.all([
      storage.listMessages(ticket.id, false),
      storage.listAttachments(ticket.id),
    ]);
    return jsonResponse(
      {
        ticket: publicTicketShape(ticket, url.origin, config, attachments),
        messages,
      },
      200,
      { ...cors, "Cache-Control": "no-store" },
    );
  }

  // POST /api/tickets/:access_token/messages — customer follow-up reply
  const replyMatch = path.match(/^\/api\/tickets\/([a-f0-9-]{16,128})\/messages$/i);
  if (replyMatch && request.method === "POST") {
    const ticket = await storage.getTicketByAccessToken(replyMatch[1]);
    if (!ticket) {
      return jsonResponse({ error: "Ticket not found." }, 404, { ...cors, "Cache-Control": "no-store" });
    }
    let bodyText = "";
    try {
      const json = (await request.json()) as { message?: unknown; body?: unknown };
      bodyText = String(json.message ?? json.body ?? "").trim();
    } catch {
      return jsonResponse({ error: "Invalid JSON body." }, 400, cors);
    }
    if (!bodyText || bodyText.length > 10_000) {
      return jsonResponse({ error: "Reply must be between 1 and 10,000 characters." }, 400, cors);
    }

    const message = await storage.addMessage({
      ticketId: ticket.id,
      senderType: "customer",
      senderName: ticket.customer_name,
      body: bodyText,
      nextStatus: "open",
      nowIso,
    });

    if (config.notifiers?.length) {
      const ticketUrl = buildPortalTicketUrl(config, url.origin, ticket.access_token);
      await Promise.allSettled(
        config.notifiers.map((n) =>
          n.send(
            { type: "ticket.replied", brandName: config.brandName, ticket: { ...ticket, status: "open" }, messageBody: bodyText, adminUrl: `${url.origin}/admin`, ticketUrl },
            env,
            fetcher,
          ),
        ),
      );
    }

    return jsonResponse({ message, status: "open" }, 201, { ...cors, "Cache-Control": "no-store" });
  }

  // GET /api/attachments/:id — stream R2 attachment (authorized by ?token=<access_token> or Bearer ADMIN_TOKEN)
  const attMatch = path.match(/^\/api\/attachments\/([a-zA-Z0-9_-]{8,80})$/);
  if (attMatch && request.method === "GET") {
    if (!env.ATTACHMENTS_BUCKET) {
      return jsonResponse({ error: "Attachments storage is not configured." }, 404, cors);
    }
    const att = await storage.getAttachment(attMatch[1]);
    if (!att) {
      return jsonResponse({ error: "Attachment not found." }, 404, cors);
    }

    let authorized = isAuthorizedAdmin(request, env);
    if (!authorized) {
      const tokenParam = url.searchParams.get("token")?.trim() ?? "";
      if (tokenParam) {
        const ticket = await storage.getTicketByAccessToken(tokenParam);
        if (ticket && ticket.id === att.ticket_id) authorized = true;
      }
    }
    if (!authorized) {
      return jsonResponse({ error: "Unauthorized" }, 403, cors);
    }

    const object = await env.ATTACHMENTS_BUCKET.get(att.r2_key);
    if (!object) {
      return jsonResponse({ error: "Attachment binary missing from storage." }, 404, cors);
    }
    const headers = attachmentSecurityHeaders(att.filename, att.content_type, object.size);
    return new Response(object.body, { status: 200, headers });
  }

  // Built-in /admin inbox HTML UI
  if (path === "/admin" && request.method === "GET") {
    return new Response(renderSupportAdminHtml(config.brandName), {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  }

  // Admin API routes (all require Bearer ADMIN_TOKEN)
  if (path.startsWith("/admin/api/")) {
    if (!isAuthorizedAdmin(request, env)) {
      return jsonResponse({ error: "Unauthorized" }, 401, { ...cors, "Cache-Control": "no-store" });
    }

    if (path === "/admin/api/tickets" && request.method === "GET") {
      const rawStatus = url.searchParams.get("status")?.trim() || "open";
      const status = rawStatus === "all" || VALID_STATUSES.has(rawStatus as TicketStatus)
        ? (rawStatus as TicketStatus | "all")
        : "open";
      const search = url.searchParams.get("q") ?? "";
      const tickets = await storage.listTickets({ status, search, limit: 100 });
      return jsonResponse({ tickets }, 200, { ...cors, "Cache-Control": "no-store" });
    }

    const adminTicketMatch = path.match(/^\/admin\/api\/tickets\/([A-Z0-9-]+)$/i);
    if (adminTicketMatch && request.method === "GET") {
      const ticket = await storage.getTicketByCode(adminTicketMatch[1].toUpperCase());
      if (!ticket) return jsonResponse({ error: "Ticket not found." }, 404, cors);
      const [messages, attachments] = await Promise.all([
        storage.listMessages(ticket.id, true),
        storage.listAttachments(ticket.id),
      ]);
      return jsonResponse({ ticket, messages, attachments }, 200, { ...cors, "Cache-Control": "no-store" });
    }

    if (adminTicketMatch && request.method === "PATCH") {
      const code = adminTicketMatch[1].toUpperCase();
      let body: { status?: unknown; priority?: unknown };
      try {
        body = (await request.json()) as { status?: unknown; priority?: unknown };
      } catch {
        return jsonResponse({ error: "Invalid JSON body." }, 400, cors);
      }
      const status = typeof body.status === "string" && VALID_STATUSES.has(body.status as TicketStatus)
        ? (body.status as TicketStatus)
        : undefined;
      const priority = typeof body.priority === "string" && VALID_PRIORITIES.has(body.priority as TicketPriority)
        ? (body.priority as TicketPriority)
        : undefined;
      const updated = await storage.updateTicket(code, { status, priority, nowIso });
      if (!updated) return jsonResponse({ error: "Ticket not found." }, 404, cors);
      return jsonResponse({ ticket: updated }, 200, { ...cors, "Cache-Control": "no-store" });
    }

    const adminReplyMatch = path.match(/^\/admin\/api\/tickets\/([A-Z0-9-]+)\/reply$/i);
    if (adminReplyMatch && request.method === "POST") {
      const code = adminReplyMatch[1].toUpperCase();
      const ticket = await storage.getTicketByCode(code);
      if (!ticket) return jsonResponse({ error: "Ticket not found." }, 404, cors);
      let body: { body?: unknown; internal?: unknown; status?: unknown };
      try {
        body = (await request.json()) as { body?: unknown; internal?: unknown; status?: unknown };
      } catch {
        return jsonResponse({ error: "Invalid JSON body." }, 400, cors);
      }
      const text = typeof body.body === "string" ? body.body.trim() : "";
      if (!text || text.length > 20_000) {
        return jsonResponse({ error: "Reply body is required." }, 400, cors);
      }
      const internal = Boolean(body.internal);
      const nextStatus =
        !internal && typeof body.status === "string" && VALID_STATUSES.has(body.status as TicketStatus)
          ? (body.status as TicketStatus)
          : !internal
            ? "waiting_on_customer"
            : undefined;

      const message = await storage.addMessage({
        ticketId: ticket.id,
        senderType: internal ? "internal_note" : "agent",
        senderName: agentDisplayName,
        body: text,
        nextStatus,
        nowIso,
      });

      if (!internal && config.email) {
        const ticketUrl = buildPortalTicketUrl(config, url.origin, ticket.access_token);
        await Promise.allSettled([
          config.email.send(
            {
              to: ticket.customer_email,
              subject: `Re: [${ticket.ticket_code}] ${ticket.subject}`,
              text: [
                text,
                "",
                "---",
                `Reply or view your ticket (${ticket.ticket_code}):`,
                ticketUrl,
              ].join("\n"),
            },
            env,
            fetcher,
          ),
        ]);
      }

      return jsonResponse({ message, status: nextStatus ?? ticket.status }, 201, { ...cors, "Cache-Control": "no-store" });
    }
  }

  return jsonResponse({ error: "Not found" }, 404, cors);
}

export function createSupportWorker(config: SupportWorkerConfig) {
  return {
    async fetch(request: Request, env: SupportWorkerEnv): Promise<Response> {
      return handleSupportRequest(request, env, config);
    },
  };
}
