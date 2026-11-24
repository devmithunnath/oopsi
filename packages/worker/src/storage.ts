import type {
  MessageSenderType,
  SupportAttachment,
  SupportMessage,
  SupportTicket,
  TicketPriority,
  TicketStatus,
} from "./types.ts";

export interface CreateTicketInput {
  ticketPrefix: string;
  startingTicketNumber: number;
  accessToken: string;
  category: string;
  source: string;
  customerName: string;
  customerEmail: string;
  customerVerified: boolean;
  customerBadge: string | null;
  subject: string;
  messageBody: string;
  metadata: Record<string, string>;
  nowIso: string;
}

export interface ListTicketsFilter {
  status?: TicketStatus | "all";
  search?: string;
  limit?: number;
}

export interface SupportStorage {
  createTicket(input: CreateTicketInput): Promise<{ ticket: SupportTicket; message: SupportMessage }>;
  getTicketByAccessToken(accessToken: string): Promise<SupportTicket | null>;
  getTicketByCode(ticketCode: string): Promise<SupportTicket | null>;
  listTickets(filter: ListTicketsFilter): Promise<SupportTicket[]>;
  listMessages(ticketId: number, includeInternal: boolean): Promise<SupportMessage[]>;
  addMessage(params: {
    ticketId: number;
    senderType: MessageSenderType;
    senderName: string;
    body: string;
    nextStatus?: TicketStatus;
    nowIso: string;
  }): Promise<SupportMessage>;
  updateTicket(
    ticketCode: string,
    patch: { status?: TicketStatus; priority?: TicketPriority; nowIso: string },
  ): Promise<SupportTicket | null>;
  createAttachment(attachment: SupportAttachment): Promise<void>;
  getAttachment(id: string): Promise<SupportAttachment | null>;
  listAttachments(ticketId: number): Promise<SupportAttachment[]>;
  checkAndIncrementRateLimit(
    bucketKey: string,
    nowSec: number,
    windowSec: number,
    maxRequests: number,
  ): Promise<{ allowed: boolean; count: number }>;
}

interface RawTicketRow {
  id: number;
  ticket_code: string;
  access_token: string;
  status: TicketStatus;
  priority: TicketPriority;
  category: string;
  source: string;
  customer_name: string;
  customer_email: string;
  customer_verified: number;
  customer_badge: string | null;
  subject: string;
  metadata_json: string;
  last_reply_by: "customer" | "agent";
  created_at: string;
  updated_at: string;
}

function hydrateTicket(row: RawTicketRow): SupportTicket {
  let metadata: Record<string, string> = {};
  try {
    const parsed = JSON.parse(row.metadata_json);
    if (parsed && typeof parsed === "object") metadata = parsed as Record<string, string>;
  } catch {
    metadata = {};
  }
  return {
    id: row.id,
    ticket_code: row.ticket_code,
    access_token: row.access_token,
    status: row.status,
    priority: row.priority,
    category: row.category,
    source: row.source,
    customer_name: row.customer_name,
    customer_email: row.customer_email,
    customer_verified: row.customer_verified === 1,
    customer_badge: row.customer_badge,
    subject: row.subject,
    metadata,
    last_reply_by: row.last_reply_by,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export class D1SupportStorage implements SupportStorage {
  private readonly db: D1Database;

  constructor(db: D1Database) {
    this.db = db;
  }

  async createTicket(input: CreateTicketInput): Promise<{ ticket: SupportTicket; message: SupportMessage }> {
    const tempCode = `TMP-${input.accessToken.slice(0, 12)}`;
    const insertRes = await this.db
      .prepare(
        `INSERT INTO support_tickets
          (ticket_code, access_token, status, priority, category, source,
           customer_name, customer_email, customer_verified, customer_badge,
           subject, metadata_json, last_reply_by, created_at, updated_at)
         VALUES (?, ?, 'open', 'normal', ?, ?, ?, ?, ?, ?, ?, ?, 'customer', ?, ?)`,
      )
      .bind(
        tempCode,
        input.accessToken,
        input.category,
        input.source,
        input.customerName,
        input.customerEmail,
        input.customerVerified ? 1 : 0,
        input.customerBadge,
        input.subject,
        JSON.stringify(input.metadata),
        input.nowIso,
        input.nowIso,
      )
      .run();

    const ticketId = Number(insertRes.meta?.last_row_id ?? 0);
    const ticketCode = `${input.ticketPrefix}-${input.startingTicketNumber + ticketId}`;

    await this.db
      .prepare("UPDATE support_tickets SET ticket_code = ? WHERE id = ?")
      .bind(ticketCode, ticketId)
      .run();

    const msgRes = await this.db
      .prepare(
        `INSERT INTO support_messages (ticket_id, sender_type, sender_name, body, created_at)
         VALUES (?, 'customer', ?, ?, ?)`,
      )
      .bind(ticketId, input.customerName, input.messageBody, input.nowIso)
      .run();

    const messageId = Number(msgRes.meta?.last_row_id ?? 0);
    const ticket = await this.getTicketByCode(ticketCode);
    if (!ticket) {
      throw new Error("Failed to read back created support ticket.");
    }
    return {
      ticket,
      message: {
        id: messageId,
        ticket_id: ticketId,
        sender_type: "customer",
        sender_name: input.customerName,
        body: input.messageBody,
        created_at: input.nowIso,
      },
    };
  }

  async getTicketByAccessToken(accessToken: string): Promise<SupportTicket | null> {
    const row = await this.db
      .prepare("SELECT * FROM support_tickets WHERE access_token = ?")
      .bind(accessToken)
      .first<RawTicketRow>();
    return row ? hydrateTicket(row) : null;
  }

  async getTicketByCode(ticketCode: string): Promise<SupportTicket | null> {
    const row = await this.db
      .prepare("SELECT * FROM support_tickets WHERE ticket_code = ?")
      .bind(ticketCode)
      .first<RawTicketRow>();
    return row ? hydrateTicket(row) : null;
  }

  async listTickets(filter: ListTicketsFilter): Promise<SupportTicket[]> {
    const clauses: string[] = [];
    const binds: unknown[] = [];

    if (filter.status && filter.status !== "all") {
      clauses.push("status = ?");
      binds.push(filter.status);
    }
    if (filter.search?.trim()) {
      const q = `%${filter.search.trim().toLowerCase()}%`;
      clauses.push("(LOWER(ticket_code) LIKE ? OR LOWER(customer_email) LIKE ? OR LOWER(subject) LIKE ? OR LOWER(customer_name) LIKE ?)");
      binds.push(q, q, q, q);
    }

    const where = clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "";
    const limit = Math.max(1, Math.min(200, filter.limit ?? 100));
    binds.push(limit);

    const res = await this.db
      .prepare(`SELECT * FROM support_tickets ${where} ORDER BY updated_at DESC, id DESC LIMIT ?`)
      .bind(...binds)
      .all<RawTicketRow>();
    return (res.results ?? []).map(hydrateTicket);
  }

  async listMessages(ticketId: number, includeInternal: boolean): Promise<SupportMessage[]> {
    const sql = includeInternal
      ? "SELECT * FROM support_messages WHERE ticket_id = ? ORDER BY id ASC"
      : "SELECT * FROM support_messages WHERE ticket_id = ? AND sender_type != 'internal_note' ORDER BY id ASC";
    const res = await this.db.prepare(sql).bind(ticketId).all<SupportMessage>();
    return res.results ?? [];
  }

  async addMessage(params: {
    ticketId: number;
    senderType: MessageSenderType;
    senderName: string;
    body: string;
    nextStatus?: TicketStatus;
    nowIso: string;
  }): Promise<SupportMessage> {
    const res = await this.db
      .prepare(
        `INSERT INTO support_messages (ticket_id, sender_type, sender_name, body, created_at)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .bind(params.ticketId, params.senderType, params.senderName, params.body, params.nowIso)
      .run();

    if (params.senderType !== "internal_note") {
      const lastReplyBy = params.senderType === "agent" ? "agent" : "customer";
      if (params.nextStatus) {
        await this.db
          .prepare("UPDATE support_tickets SET status = ?, last_reply_by = ?, updated_at = ? WHERE id = ?")
          .bind(params.nextStatus, lastReplyBy, params.nowIso, params.ticketId)
          .run();
      } else {
        await this.db
          .prepare("UPDATE support_tickets SET last_reply_by = ?, updated_at = ? WHERE id = ?")
          .bind(lastReplyBy, params.nowIso, params.ticketId)
          .run();
      }
    } else {
      await this.db
        .prepare("UPDATE support_tickets SET updated_at = ? WHERE id = ?")
        .bind(params.nowIso, params.ticketId)
        .run();
    }

    return {
      id: Number(res.meta?.last_row_id ?? 0),
      ticket_id: params.ticketId,
      sender_type: params.senderType,
      sender_name: params.senderName,
      body: params.body,
      created_at: params.nowIso,
    };
  }

  async updateTicket(
    ticketCode: string,
    patch: { status?: TicketStatus; priority?: TicketPriority; nowIso: string },
  ): Promise<SupportTicket | null> {
    const existing = await this.getTicketByCode(ticketCode);
    if (!existing) return null;
    await this.db
      .prepare("UPDATE support_tickets SET status = ?, priority = ?, updated_at = ? WHERE ticket_code = ?")
      .bind(patch.status ?? existing.status, patch.priority ?? existing.priority, patch.nowIso, ticketCode)
      .run();
    return this.getTicketByCode(ticketCode);
  }

  async createAttachment(attachment: SupportAttachment): Promise<void> {
    await this.db
      .prepare(
        `INSERT INTO support_attachments
          (id, ticket_id, message_id, r2_key, filename, content_type, size_bytes, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        attachment.id,
        attachment.ticket_id,
        attachment.message_id,
        attachment.r2_key,
        attachment.filename,
        attachment.content_type,
        attachment.size_bytes,
        attachment.created_at,
      )
      .run();
  }

  async getAttachment(id: string): Promise<SupportAttachment | null> {
    const row = await this.db
      .prepare("SELECT * FROM support_attachments WHERE id = ?")
      .bind(id)
      .first<SupportAttachment>();
    return row ?? null;
  }

  async listAttachments(ticketId: number): Promise<SupportAttachment[]> {
    const res = await this.db
      .prepare("SELECT * FROM support_attachments WHERE ticket_id = ? ORDER BY created_at ASC")
      .bind(ticketId)
      .all<SupportAttachment>();
    return res.results ?? [];
  }

  async checkAndIncrementRateLimit(
    bucketKey: string,
    nowSec: number,
    windowSec: number,
    maxRequests: number,
  ): Promise<{ allowed: boolean; count: number }> {
    const existing = await this.db
      .prepare("SELECT count, window_start_sec FROM support_rate_limits WHERE bucket_key = ?")
      .bind(bucketKey)
      .first<{ count: number; window_start_sec: number }>();

    if (!existing || nowSec - existing.window_start_sec >= windowSec) {
      await this.db
        .prepare(
          `INSERT INTO support_rate_limits (bucket_key, count, window_start_sec)
           VALUES (?, 1, ?)
           ON CONFLICT(bucket_key) DO UPDATE SET count = 1, window_start_sec = excluded.window_start_sec`,
        )
        .bind(bucketKey, nowSec)
        .run();
      return { allowed: true, count: 1 };
    }

    if (existing.count >= maxRequests) {
      return { allowed: false, count: existing.count };
    }

    const nextCount = existing.count + 1;
    await this.db
      .prepare("UPDATE support_rate_limits SET count = ? WHERE bucket_key = ?")
      .bind(nextCount, bucketKey)
      .run();
    return { allowed: true, count: nextCount };
  }
}

export class MemorySupportStorage implements SupportStorage {
  private nextTicketId = 1;
  private nextMessageId = 1;
  private tickets: SupportTicket[] = [];
  private messages: SupportMessage[] = [];
  private attachments: SupportAttachment[] = [];
  private rateLimits = new Map<string, { count: number; windowStartSec: number }>();

  async createTicket(input: CreateTicketInput): Promise<{ ticket: SupportTicket; message: SupportMessage }> {
    const id = this.nextTicketId++;
    const ticket: SupportTicket = {
      id,
      ticket_code: `${input.ticketPrefix}-${input.startingTicketNumber + id}`,
      access_token: input.accessToken,
      status: "open",
      priority: "normal",
      category: input.category,
      source: input.source,
      customer_name: input.customerName,
      customer_email: input.customerEmail,
      customer_verified: input.customerVerified,
      customer_badge: input.customerBadge,
      subject: input.subject,
      metadata: { ...input.metadata },
      last_reply_by: "customer",
      created_at: input.nowIso,
      updated_at: input.nowIso,
    };
    this.tickets.push(ticket);
    const message: SupportMessage = {
      id: this.nextMessageId++,
      ticket_id: id,
      sender_type: "customer",
      sender_name: input.customerName,
      body: input.messageBody,
      created_at: input.nowIso,
    };
    this.messages.push(message);
    return { ticket: structuredClone(ticket), message: structuredClone(message) };
  }

  async getTicketByAccessToken(accessToken: string): Promise<SupportTicket | null> {
    const found = this.tickets.find((t) => t.access_token === accessToken);
    return found ? structuredClone(found) : null;
  }

  async getTicketByCode(ticketCode: string): Promise<SupportTicket | null> {
    const found = this.tickets.find((t) => t.ticket_code === ticketCode);
    return found ? structuredClone(found) : null;
  }

  async listTickets(filter: ListTicketsFilter): Promise<SupportTicket[]> {
    const q = filter.search?.trim().toLowerCase() ?? "";
    return this.tickets
      .filter((t) => {
        if (filter.status && filter.status !== "all" && t.status !== filter.status) return false;
        if (
          q &&
          !t.ticket_code.toLowerCase().includes(q) &&
          !t.customer_email.toLowerCase().includes(q) &&
          !t.subject.toLowerCase().includes(q) &&
          !t.customer_name.toLowerCase().includes(q)
        ) {
          return false;
        }
        return true;
      })
      .sort((a, b) => b.updated_at.localeCompare(a.updated_at) || b.id - a.id)
      .slice(0, filter.limit ?? 100)
      .map((t) => structuredClone(t));
  }

  async listMessages(ticketId: number, includeInternal: boolean): Promise<SupportMessage[]> {
    return this.messages
      .filter((m) => m.ticket_id === ticketId && (includeInternal || m.sender_type !== "internal_note"))
      .map((m) => structuredClone(m));
  }

  async addMessage(params: {
    ticketId: number;
    senderType: MessageSenderType;
    senderName: string;
    body: string;
    nextStatus?: TicketStatus;
    nowIso: string;
  }): Promise<SupportMessage> {
    const message: SupportMessage = {
      id: this.nextMessageId++,
      ticket_id: params.ticketId,
      sender_type: params.senderType,
      sender_name: params.senderName,
      body: params.body,
      created_at: params.nowIso,
    };
    this.messages.push(message);
    const ticket = this.tickets.find((t) => t.id === params.ticketId);
    if (ticket) {
      ticket.updated_at = params.nowIso;
      if (params.senderType !== "internal_note") {
        ticket.last_reply_by = params.senderType === "agent" ? "agent" : "customer";
        if (params.nextStatus) ticket.status = params.nextStatus;
      }
    }
    return structuredClone(message);
  }

  async updateTicket(
    ticketCode: string,
    patch: { status?: TicketStatus; priority?: TicketPriority; nowIso: string },
  ): Promise<SupportTicket | null> {
    const ticket = this.tickets.find((t) => t.ticket_code === ticketCode);
    if (!ticket) return null;
    if (patch.status) ticket.status = patch.status;
    if (patch.priority) ticket.priority = patch.priority;
    ticket.updated_at = patch.nowIso;
    return structuredClone(ticket);
  }

  async createAttachment(attachment: SupportAttachment): Promise<void> {
    this.attachments.push(structuredClone(attachment));
  }

  async getAttachment(id: string): Promise<SupportAttachment | null> {
    const found = this.attachments.find((a) => a.id === id);
    return found ? structuredClone(found) : null;
  }

  async listAttachments(ticketId: number): Promise<SupportAttachment[]> {
    return this.attachments.filter((a) => a.ticket_id === ticketId).map((a) => structuredClone(a));
  }

  async checkAndIncrementRateLimit(
    bucketKey: string,
    nowSec: number,
    windowSec: number,
    maxRequests: number,
  ): Promise<{ allowed: boolean; count: number }> {
    const existing = this.rateLimits.get(bucketKey);
    if (!existing || nowSec - existing.windowStartSec >= windowSec) {
      this.rateLimits.set(bucketKey, { count: 1, windowStartSec: nowSec });
      return { allowed: true, count: 1 };
    }
    if (existing.count >= maxRequests) {
      return { allowed: false, count: existing.count };
    }
    existing.count += 1;
    return { allowed: true, count: existing.count };
  }
}
