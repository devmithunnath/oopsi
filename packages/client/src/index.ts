export type OopsiTicketStatus = "open" | "waiting_on_customer" | "resolved" | "closed";

export interface OopsiAttachment {
  id: string;
  message_id: number;
  filename: string;
  content_type: string;
  size_bytes: number;
  download_url: string;
  created_at: string;
}

export interface OopsiPublicTicket {
  ticket_code: string;
  status: OopsiTicketStatus;
  category: string;
  source: string;
  customer_name: string;
  subject: string;
  created_at: string;
  updated_at: string;
  ticket_url: string;
  attachments: OopsiAttachment[];
}

export interface OopsiMessage {
  id: number;
  ticket_id: number;
  sender_type: "customer" | "agent";
  sender_name: string;
  body: string;
  created_at: string;
}

export interface CreateTicketParams {
  name?: string;
  email: string;
  category?: string;
  source?: string;
  subject: string;
  message: string;
  metadata?: Record<string, string>;
  attachment?: File | Blob & { name?: string };
  attachmentName?: string;
  /** Leave blank — honeypot trap field. */
  website?: string;
}

export interface CreateTicketResponse {
  ticket_code: string;
  access_token: string;
  ticket_url: string;
  status: OopsiTicketStatus;
  attachments?: OopsiAttachment[];
}

export interface TicketThreadResponse {
  ticket: OopsiPublicTicket;
  messages: OopsiMessage[];
}

export class OopsiApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "OopsiApiError";
    this.status = status;
  }
}

export class OopsiClient {
  private readonly baseUrl: string;
  private readonly fetcher: typeof fetch;

  constructor(options: { apiUrl: string; fetch?: typeof fetch }) {
    this.baseUrl = options.apiUrl.trim().replace(/\/+$/, "");
    this.fetcher = options.fetch ?? fetch;
  }

  async createTicket(params: CreateTicketParams): Promise<CreateTicketResponse> {
    let response: Response;
    if (params.attachment) {
      const form = new FormData();
      if (params.name) form.set("name", params.name);
      form.set("email", params.email);
      if (params.category) form.set("category", params.category);
      if (params.source) form.set("source", params.source);
      form.set("subject", params.subject);
      form.set("message", params.message);
      if (params.website) form.set("website", params.website);
      if (params.metadata && Object.keys(params.metadata).length > 0) {
        form.set("metadata", JSON.stringify(params.metadata));
      }
      const filename = params.attachmentName || ("name" in params.attachment && params.attachment.name) || "attachment.bin";
      form.set("attachment", params.attachment, filename);
      response = await this.fetcher(`${this.baseUrl}/api/tickets`, {
        method: "POST",
        body: form,
      });
    } else {
      response = await this.fetcher(`${this.baseUrl}/api/tickets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: params.name,
          email: params.email,
          category: params.category,
          source: params.source,
          subject: params.subject,
          message: params.message,
          metadata: params.metadata,
          website: params.website,
        }),
      });
    }

    const data = (await response.json().catch(() => ({}))) as Partial<CreateTicketResponse> & { error?: string };
    if (!response.ok || !data.ticket_code) {
      throw new OopsiApiError(data.error || `Request failed (HTTP ${response.status})`, response.status);
    }
    return data as CreateTicketResponse;
  }

  async getTicket(accessToken: string): Promise<TicketThreadResponse> {
    const response = await this.fetcher(
      `${this.baseUrl}/api/tickets/${encodeURIComponent(accessToken.trim())}`,
      { cache: "no-store" },
    );
    const data = (await response.json().catch(() => ({}))) as Partial<TicketThreadResponse> & { error?: string };
    if (!response.ok || !data.ticket) {
      throw new OopsiApiError(data.error || `Ticket lookup failed (HTTP ${response.status})`, response.status);
    }
    return data as TicketThreadResponse;
  }

  async replyToTicket(accessToken: string, message: string): Promise<{ message: OopsiMessage; status: OopsiTicketStatus }> {
    const response = await this.fetcher(
      `${this.baseUrl}/api/tickets/${encodeURIComponent(accessToken.trim())}/messages`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      },
    );
    const data = (await response.json().catch(() => ({}))) as {
      message?: OopsiMessage;
      status?: OopsiTicketStatus;
      error?: string;
    };
    if (!response.ok || !data.message) {
      throw new OopsiApiError(data.error || `Reply failed (HTTP ${response.status})`, response.status);
    }
    return { message: data.message, status: data.status ?? "open" };
  }
}
