-- Oopsi v0.1 initial D1 SQLite schema for support tickets, threads, attachments, and rate limiting.

CREATE TABLE IF NOT EXISTS support_tickets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ticket_code TEXT NOT NULL UNIQUE,
  access_token TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'open',
  priority TEXT NOT NULL DEFAULT 'normal',
  category TEXT NOT NULL DEFAULT 'other',
  source TEXT NOT NULL DEFAULT 'web',
  customer_name TEXT NOT NULL,
  customer_email TEXT NOT NULL,
  customer_verified INTEGER NOT NULL DEFAULT 0,
  customer_badge TEXT,
  subject TEXT NOT NULL,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  last_reply_by TEXT NOT NULL DEFAULT 'customer',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_support_tickets_status_updated
  ON support_tickets (status, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_support_tickets_email
  ON support_tickets (customer_email);

CREATE TABLE IF NOT EXISTS support_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ticket_id INTEGER NOT NULL,
  sender_type TEXT NOT NULL,
  sender_name TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (ticket_id) REFERENCES support_tickets(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_support_messages_ticket_id
  ON support_messages (ticket_id, id ASC);

CREATE TABLE IF NOT EXISTS support_attachments (
  id TEXT PRIMARY KEY,
  ticket_id INTEGER NOT NULL,
  message_id INTEGER NOT NULL,
  r2_key TEXT NOT NULL,
  filename TEXT NOT NULL,
  content_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (ticket_id) REFERENCES support_tickets(id) ON DELETE CASCADE,
  FOREIGN KEY (message_id) REFERENCES support_messages(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_support_attachments_ticket_id
  ON support_attachments (ticket_id);

CREATE TABLE IF NOT EXISTS support_rate_limits (
  bucket_key TEXT PRIMARY KEY,
  count INTEGER NOT NULL DEFAULT 0,
  window_start_sec INTEGER NOT NULL
);
