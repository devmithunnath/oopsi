import { useMemo, useState, type FormEvent } from "react";
import { OopsiClient, type CreateTicketResponse } from "@oopsi/client";

export interface SupportCategoryOption {
  value: string;
  label: string;
}

export interface SupportFormProps {
  apiUrl: string;
  categories?: SupportCategoryOption[];
  source?: string;
  allowAttachment?: boolean;
  defaultEmail?: string;
  metadata?: Record<string, string>;
  theme?: "dark" | "light";
  className?: string;
  onSubmitted?: (result: CreateTicketResponse) => void;
}

const DEFAULT_CATEGORIES: SupportCategoryOption[] = [
  { value: "bug", label: "Bug report" },
  { value: "licensing", label: "License & activation" },
  { value: "billing", label: "Billing & refunds" },
  { value: "feature", label: "Feature idea" },
  { value: "other", label: "Other question" },
];

export function SupportForm({
  apiUrl,
  categories = DEFAULT_CATEGORIES,
  source = "web",
  allowAttachment = true,
  defaultEmail = "",
  metadata,
  theme = "dark",
  className = "",
  onSubmitted,
}: SupportFormProps) {
  const client = useMemo(() => new OopsiClient({ apiUrl }), [apiUrl]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState(defaultEmail);
  const [category, setCategory] = useState(categories[0]?.value ?? "other");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [website, setWebsite] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState<CreateTicketResponse | null>(null);
  const [copied, setCopied] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setError(null);
    setBusy(true);
    try {
      const result = await client.createTicket({
        name: name.trim() || undefined,
        email: email.trim(),
        category,
        source,
        subject: subject.trim(),
        message: message.trim(),
        metadata,
        attachment: file ?? undefined,
        attachmentName: file?.name,
        website,
      });
      setSubmitted(result);
      onSubmitted?.(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not submit your request. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  function copyLink(url: string) {
    navigator.clipboard?.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    }).catch(() => {});
  }

  const rootClass = `oopsi-root ${theme === "light" ? "oopsi-light" : ""} ${className}`.trim();

  if (submitted) {
    return (
      <div className={rootClass}>
        <div className="oopsi-card" role="status" aria-live="polite">
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
            <span className="oopsi-pill oopsi-pill-success">✓ Request received</span>
            <span className="oopsi-pill">{submitted.ticket_code}</span>
          </div>
          <h3 style={{ margin: 0, fontSize: 22, fontWeight: 750 }}>We’ve got your message.</h3>
          <p className="oopsi-muted">
            Save your private ticket link below to check status or send follow-up replies anytime — no account required.
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
            <a href={submitted.ticket_url} className="oopsi-button" style={{ textDecoration: "none" }}>
              View ticket {submitted.ticket_code}
            </a>
            <button type="button" className="oopsi-button-secondary" onClick={() => copyLink(submitted.ticket_url)}>
              {copied ? "Copied link!" : "Copy private link"}
            </button>
            <button
              type="button"
              className="oopsi-button-secondary"
              onClick={() => {
                setSubmitted(null);
                setSubject("");
                setMessage("");
                setFile(null);
              }}
            >
              Submit another
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={rootClass}>
      <form className="oopsi-card" onSubmit={handleSubmit}>
        <input
          tabIndex={-1}
          autoComplete="off"
          aria-hidden="true"
          className="oopsi-hp"
          value={website}
          onChange={(e) => setWebsite(e.target.value)}
          name="website"
        />

        <div className="oopsi-grid">
          <div className="oopsi-field">
            <label className="oopsi-label" htmlFor="oopsi-name">Your name</label>
            <input
              id="oopsi-name"
              className="oopsi-input"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Alex Rivera"
            />
          </div>
          <div className="oopsi-field">
            <label className="oopsi-label" htmlFor="oopsi-email">Email address *</label>
            <input
              id="oopsi-email"
              className="oopsi-input"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
          </div>
        </div>

        <div className="oopsi-grid">
          <div className="oopsi-field">
            <label className="oopsi-label" htmlFor="oopsi-category">Category</label>
            <select
              id="oopsi-category"
              className="oopsi-select"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              {categories.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>
          <div className="oopsi-field">
            <label className="oopsi-label" htmlFor="oopsi-subject">Subject *</label>
            <input
              id="oopsi-subject"
              className="oopsi-input"
              type="text"
              required
              maxLength={180}
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Brief summary of the issue"
            />
          </div>
        </div>

        <div className="oopsi-field">
          <label className="oopsi-label" htmlFor="oopsi-message">How can we help? *</label>
          <textarea
            id="oopsi-message"
            className="oopsi-textarea"
            required
            maxLength={10000}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Include steps to reproduce, what you expected, or your order reference."
          />
        </div>

        {allowAttachment && (
          <div className="oopsi-field">
            <label className="oopsi-label" htmlFor="oopsi-file">Attachment (optional — screenshot or redacted logs, max 10 MB)</label>
            <input
              id="oopsi-file"
              className="oopsi-input"
              type="file"
              accept=".png,.jpg,.jpeg,.webp,.gif,.txt,.log,.json,.zip,.pdf,.md,.csv"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </div>
        )}

        {error && <p className="oopsi-error" role="alert">{error}</p>}

        <div>
          <button type="submit" className="oopsi-button" disabled={busy}>
            {busy ? "Sending…" : "Submit Support Request"}
          </button>
        </div>
      </form>
    </div>
  );
}
