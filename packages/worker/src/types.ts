export type TicketStatus = "open" | "waiting_on_customer" | "resolved" | "closed";
export type TicketPriority = "normal" | "high" | "urgent";
export type MessageSenderType = "customer" | "agent" | "internal_note";

export interface SupportTicket {
  id: number;
  ticket_code: string;
  access_token: string;
  status: TicketStatus;
  priority: TicketPriority;
  category: string;
  source: string;
  customer_name: string;
  customer_email: string;
  customer_verified: boolean;
  customer_badge: string | null;
  subject: string;
  metadata: Record<string, string>;
  last_reply_by: "customer" | "agent";
  created_at: string;
  updated_at: string;
}

export interface SupportMessage {
  id: number;
  ticket_id: number;
  sender_type: MessageSenderType;
  sender_name: string;
  body: string;
  created_at: string;
}

export interface SupportAttachment {
  id: string;
  ticket_id: number;
  message_id: number;
  r2_key: string;
  filename: string;
  content_type: string;
  size_bytes: number;
  created_at: string;
}

export interface SupportWorkerEnv {
  DB: D1Database;
  ATTACHMENTS_BUCKET?: R2Bucket;
  ADMIN_TOKEN?: string;
  SUPPORT_NOTIFY_WEBHOOK?: string;
  RESEND_API_KEY?: string;
  TELEGRAM_BOT_TOKEN?: string;
  TELEGRAM_CHAT_ID?: string;
  CORS_ORIGIN?: string;
  [key: string]: unknown;
}

export interface CustomerVerificationResult {
  verified: boolean;
  badge?: string | null;
}

export interface NotifierEvent {
  type: "ticket.created" | "ticket.replied";
  brandName: string;
  ticket: SupportTicket;
  messageBody: string;
  adminUrl: string;
  ticketUrl: string;
}

export interface SupportNotifier {
  name: string;
  send(event: NotifierEvent, env: SupportWorkerEnv, fetcher: typeof fetch): Promise<void>;
}

export interface OutboundEmail {
  to: string;
  subject: string;
  text: string;
  html?: string;
  replyTo?: string;
}

export interface SupportEmailAdapter {
  name: string;
  send(email: OutboundEmail, env: SupportWorkerEnv, fetcher: typeof fetch): Promise<void>;
}

export interface SupportWorkerConfig {
  /** Display name of your product/app (e.g. "Ugli"). */
  brandName: string;
  /** Short uppercase prefix for ticket codes (e.g. "UGL" -> "UGL-1001"). Default: "OPS". */
  ticketPrefix?: string;
  /** Starting numeric offset for ticket codes (default: 1000 -> first ticket is PREFIX-1001). */
  startingTicketNumber?: number;
  /** Base URL of your public web support page (e.g. "https://ugli.app/support"). */
  portalBaseUrl?: string;
  /** Allowed browser origins for CORS (empty or ["*"] allows any origin). */
  allowedOrigins?: string[];
  /** Allowed ticket categories (default: bug, licensing, billing, feature, other). */
  categories?: string[];
  /** Max attachment size in bytes (default: 10 MB). */
  maxAttachmentBytes?: number;
  /** Max new tickets per IP per hour (default: 8). */
  rateLimitPerHour?: number;
  /** Agent display name shown to customers on replies (default: "<brandName> Support"). */
  agentDisplayName?: string;
  /** Optional customer/billing verification callback (e.g. check Dodo Payments / Stripe). */
  verifyCustomer?: (context: {
    email: string;
    metadata: Record<string, string>;
    env: SupportWorkerEnv;
  }) => Promise<CustomerVerificationResult> | CustomerVerificationResult;
  /** Optional instant notification adapters (Discord, Slack, Telegram, generic webhook). */
  notifiers?: SupportNotifier[];
  /** Optional outbound email adapter (e.g. Resend). */
  email?: SupportEmailAdapter;
}
