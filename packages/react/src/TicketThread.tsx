import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { OopsiClient, type TicketThreadResponse } from "@oopsi/client";

export interface TicketThreadProps {
  apiUrl: string;
  accessToken: string;
  theme?: "dark" | "light";
  className?: string;
}

const STATUS_LABELS: Record<string, string> = {
  open: "Open",
  waiting_on_customer: "Waiting on your reply",
  resolved: "Resolved",
  closed: "Closed",
};

export function TicketThread({ apiUrl, accessToken, theme = "dark", className = "" }: TicketThreadProps) {
  const client = useMemo(() => new OopsiClient({ apiUrl }), [apiUrl]);
  const [data, setData] = useState<TicketThreadResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    if (!accessToken.trim()) {
      setError("Missing ticket token.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await client.getTicket(accessToken);
      setData(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load this ticket.");
    } finally {
      setLoading(false);
    }
  }, [accessToken, client]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleReply(e: FormEvent) {
    e.preventDefault();
    const trimmed = reply.trim();
    if (!trimmed || sending) return;
    setSending(true);
    setError(null);
    try {
      await client.replyToTicket(accessToken, trimmed);
      setReply("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not post your reply.");
    } finally {
      setSending(false);
    }
  }

  const rootClass = `oopsi-root ${theme === "light" ? "oopsi-light" : ""} ${className}`.trim();

  if (loading && !data) {
    return (
      <div className={rootClass}>
        <div className="oopsi-card"><p className="oopsi-muted">Loading ticket…</p></div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className={rootClass}>
        <div className="oopsi-card">
          <p className="oopsi-error" role="alert">{error}</p>
        </div>
      </div>
    );
  }

  if (!data) return null;
  const { ticket, messages } = data;

  return (
    <div className={rootClass}>
      <div className="oopsi-card">
        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
            <span className="oopsi-pill">{ticket.ticket_code}</span>
            <span className={`oopsi-pill ${ticket.status === "resolved" ? "oopsi-pill-success" : ""}`}>
              {STATUS_LABELS[ticket.status] ?? ticket.status}
            </span>
          </div>
          <button type="button" className="oopsi-button-secondary" onClick={() => void load()}>
            Refresh
          </button>
        </div>

        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 750 }}>{ticket.subject}</h2>

        {ticket.attachments.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {ticket.attachments.map((att) => (
              <a key={att.id} href={att.download_url} className="oopsi-button-secondary" style={{ fontFamily: "var(--oopsi-mono)", fontSize: 12.5 }}>
                📎 {att.filename} ({Math.max(1, Math.round(att.size_bytes / 1024))} KB)
              </a>
            ))}
          </div>
        )}

        <div className="oopsi-thread">
          {messages.map((m) => (
            <div key={m.id} className={`oopsi-msg ${m.sender_type === "agent" ? "oopsi-msg-agent" : ""}`}>
              <div className="oopsi-msg-head">
                <strong>{m.sender_name}</strong>
                <span>{new Date(m.created_at).toLocaleString()}</span>
              </div>
              <div className="oopsi-msg-body">{m.body}</div>
            </div>
          ))}
        </div>

        {ticket.status !== "closed" && (
          <form onSubmit={handleReply} style={{ display: "flex", flexDirection: "column", gap: 10, paddingTop: 6 }}>
            <label className="oopsi-label" htmlFor="oopsi-reply">Add a follow-up reply</label>
            <textarea
              id="oopsi-reply"
              className="oopsi-textarea"
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              placeholder="Write your reply…"
              required
            />
            {error && <p className="oopsi-error" role="alert">{error}</p>}
            <div>
              <button type="submit" className="oopsi-button" disabled={sending}>
                {sending ? "Sending reply…" : "Send Reply"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
