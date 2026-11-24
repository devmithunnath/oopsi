export function renderSupportAdminHtml(brandName: string): string {
  const safeBrand = brandName.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c,
  );
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${safeBrand} Support Inbox · Oopsi</title>
<style>
  :root {
    --bg: #0e1116;
    --surface: #141921;
    --raised: #1b222d;
    --border: #262d38;
    --text: #f0f6fc;
    --muted: #8b949e;
    --coral: #ff6b4a;
    --coral-ink: #0e1116;
    --mint: #34d399;
    --mint-ink: #06281e;
    --amber: #f59e0b;
    --danger: #fb7185;
  }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    background: var(--bg);
    color: var(--text);
    font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    font-size: 14px;
    line-height: 1.5;
  }
  .mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px; }
  .hidden { display: none !important; }
  header {
    display: flex; align-items: center; justify-content: space-between; gap: 12px;
    padding: 14px 20px; border-bottom: 1px solid var(--border); background: var(--surface);
  }
  .brand { display: flex; align-items: center; gap: 10px; font-weight: 700; font-size: 16px; }
  .brand-dot {
    width: 28px; height: 28px; border-radius: 8px; background: var(--coral); color: var(--coral-ink);
    display: inline-flex; align-items: center; justify-content: center; font-weight: 800; font-size: 14px;
  }
  .pill {
    display: inline-flex; align-items: center; gap: 5px; padding: 2px 9px; border-radius: 999px;
    font-size: 11.5px; font-weight: 600; background: var(--raised); border: 1px solid var(--border); color: var(--muted);
  }
  .pill.coral { background: rgba(255,107,74,0.16); border-color: rgba(255,107,74,0.38); color: var(--coral); }
  .pill.mint { background: rgba(52,211,153,0.15); border-color: rgba(52,211,153,0.38); color: var(--mint); }
  .pill.amber { background: rgba(245,158,11,0.15); border-color: rgba(245,158,11,0.38); color: var(--amber); }
  button, input, select, textarea {
    font: inherit; color: var(--text); background: var(--bg); border: 1px solid var(--border);
    border-radius: 8px; padding: 8px 11px;
  }
  button { background: var(--raised); cursor: pointer; font-weight: 600; }
  button.primary { background: var(--coral); color: var(--coral-ink); border-color: var(--coral); }
  button.mint { background: var(--mint); color: var(--mint-ink); border-color: var(--mint); }
  button.active { border-color: var(--coral); color: var(--coral); }
  .auth-wrap { max-width: 440px; margin: 90px auto; padding: 24px; background: var(--surface); border: 1px solid var(--border); border-radius: 16px; }
  .auth-wrap h1 { margin: 0 0 8px; font-size: 20px; }
  .auth-wrap p { margin: 0 0 16px; color: var(--muted); }
  .row { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
  .status-msg { margin-top: 10px; font-size: 13px; color: var(--mint); min-height: 18px; }
  .status-msg.err { color: var(--danger); }
  .layout { display: grid; grid-template-columns: 350px 1fr; min-height: calc(100vh - 58px); }
  @media (max-width: 860px) { .layout { grid-template-columns: 1fr; } }
  .sidebar { border-right: 1px solid var(--border); background: var(--surface); display: flex; flex-direction: column; }
  .sidebar-controls { padding: 12px; border-bottom: 1px solid var(--border); display: flex; flex-direction: column; gap: 8px; }
  .ticket-list { flex: 1; overflow-y: auto; }
  .ticket-item {
    padding: 12px 14px; border-bottom: 1px solid var(--border); cursor: pointer;
    display: flex; flex-direction: column; gap: 4px;
  }
  .ticket-item:hover { background: var(--raised); }
  .ticket-item.selected { background: rgba(255,107,74,0.10); border-left: 3px solid var(--coral); }
  .ticket-subject { font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .detail { padding: 20px 24px; display: flex; flex-direction: column; gap: 16px; max-width: 920px; }
  .card { background: var(--surface); border: 1px solid var(--border); border-radius: 14px; padding: 16px; }
  .messages { display: flex; flex-direction: column; gap: 10px; }
  .msg { padding: 12px 14px; border-radius: 12px; border: 1px solid var(--border); background: var(--surface); }
  .msg.agent { border-color: rgba(52,211,153,0.4); background: rgba(52,211,153,0.06); }
  .msg.internal_note { border-style: dashed; border-color: rgba(245,158,11,0.5); background: rgba(245,158,11,0.06); }
  .msg-head { display: flex; justify-content: space-between; gap: 8px; margin-bottom: 6px; font-size: 12px; color: var(--muted); }
  .msg-body { white-space: pre-wrap; word-break: break-word; }
  textarea { width: 100%; min-height: 100px; resize: vertical; }
</style>
</head>
<body>
<header>
  <div class="brand">
    <span class="brand-dot">o</span>
    <span>${safeBrand} Support</span>
    <span class="pill">Powered by Oopsi</span>
  </div>
  <div class="row hidden" id="header-actions">
    <button id="refresh-btn">Refresh</button>
    <button id="signout-btn">Sign Out</button>
  </div>
</header>

<section class="auth-wrap" id="auth-view">
  <h1>Sign in to Support Inbox</h1>
  <p>Enter your <code class="mono">ADMIN_TOKEN</code> Cloudflare Worker secret.</p>
  <div class="row">
    <input id="token-input" type="password" placeholder="ADMIN_TOKEN" style="flex:1">
    <button class="primary" id="connect-btn">Sign In</button>
  </div>
  <div class="status-msg" id="auth-msg"></div>
</section>

<div class="layout hidden" id="inbox-view">
  <aside class="sidebar">
    <div class="sidebar-controls">
      <input id="search-input" type="search" placeholder="Search code, email, subject…">
      <div class="row" id="filter-tabs">
        <button data-status="open" class="active">Open</button>
        <button data-status="waiting_on_customer">Waiting</button>
        <button data-status="resolved">Resolved</button>
        <button data-status="all">All</button>
      </div>
    </div>
    <div class="ticket-list" id="ticket-list"></div>
  </aside>

  <main class="detail" id="detail-pane">
    <div class="card" style="color:var(--muted)">Select a ticket on the left to inspect and reply.</div>
  </main>
</div>

<script>
let token = sessionStorage.getItem("oopsi_admin_token") || "";
let activeStatus = "open";
let selectedCode = null;
const $ = (id) => document.getElementById(id);

function esc(v) {
  return String(v == null ? "" : v).replace(/[&<>"']/g, (c) => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" })[c]);
}

async function api(path, opts = {}) {
  const res = await fetch(path, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + token,
      ...(opts.headers || {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || ("HTTP " + res.status));
  return data;
}

async function downloadAttachment(id, filename) {
  const res = await fetch("/api/attachments/" + encodeURIComponent(id), {
    headers: { Authorization: "Bearer " + token },
  });
  if (!res.ok) return alert("Failed to download attachment (" + res.status + ")");
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

async function loadTickets() {
  const params = new URLSearchParams({ status: activeStatus });
  const q = $("search-input").value.trim();
  if (q) params.set("q", q);
  const data = await api("/admin/api/tickets?" + params.toString());
  const list = $("ticket-list");
  list.innerHTML = "";
  const items = data.tickets || [];
  if (!items.length) {
    list.innerHTML = '<div style="padding:18px;color:var(--muted)">No tickets match this filter.</div>';
    return;
  }
  items.forEach((t) => {
    const div = document.createElement("div");
    div.className = "ticket-item" + (t.ticket_code === selectedCode ? " selected" : "");
    div.innerHTML = \`
      <div class="row" style="justify-content:space-between">
        <span class="pill coral mono">\${esc(t.ticket_code)}</span>
        <span class="mono" style="color:var(--muted)">\${esc(t.status)}</span>
      </div>
      <div class="ticket-subject">\${esc(t.subject)}</div>
      <div class="row" style="justify-content:space-between; font-size:12px; color:var(--muted)">
        <span>\${esc(t.customer_email)}</span>
        \${t.customer_verified ? '<span class="pill mint">✓ ' + esc(t.customer_badge || "Verified") + "</span>" : ""}
      </div>
    \`;
    div.onclick = () => selectTicket(t.ticket_code);
    list.appendChild(div);
  });
}

async function selectTicket(code) {
  selectedCode = code;
  loadTickets().catch(() => {});
  const data = await api("/admin/api/tickets/" + encodeURIComponent(code));
  const t = data.ticket;
  const msgs = data.messages || [];
  const atts = data.attachments || [];
  const metaChips = Object.entries(t.metadata || {})
    .map(([k, v]) => \`<span class="pill mono">\${esc(k)}: \${esc(v)}</span>\`)
    .join("");

  const pane = $("detail-pane");
  pane.innerHTML = \`
    <div class="card">
      <div class="row" style="justify-content:space-between; margin-bottom:10px">
        <div class="row">
          <span class="pill coral mono">\${esc(t.ticket_code)}</span>
          <span class="pill">\${esc(t.category)}</span>
          <span class="pill mono">\${esc(t.source)}</span>
          \${t.customer_verified ? '<span class="pill mint">✓ ' + esc(t.customer_badge || "Verified Customer") + "</span>" : ""}
        </div>
        <div class="row">
          <select id="status-select">
            <option value="open">Open</option>
            <option value="waiting_on_customer">Waiting on customer</option>
            <option value="resolved">Resolved</option>
            <option value="closed">Closed</option>
          </select>
          <select id="priority-select">
            <option value="normal">Normal</option>
            <option value="high">High</option>
            <option value="urgent">Urgent</option>
          </select>
        </div>
      </div>
      <h2 style="margin:0 0 6px; font-size:19px">\${esc(t.subject)}</h2>
      <div style="color:var(--muted); font-size:13px; margin-bottom:10px">
        \${esc(t.customer_name)} &lt;\${esc(t.customer_email)}&gt; · Opened <span class="mono">\${esc(t.created_at)}</span>
      </div>
      \${metaChips ? '<div class="row" style="margin-bottom:8px">' + metaChips + "</div>" : ""}
      \${atts.length ? '<div class="row" id="att-row"></div>' : ""}
      <div class="status-msg" id="detail-msg"></div>
    </div>

    <div class="messages" id="messages-box">
      \${msgs.map((m) => \`
        <div class="msg \${esc(m.sender_type)}">
          <div class="msg-head">
            <strong>\${esc(m.sender_name)} \${m.sender_type === "internal_note" ? "(Internal Note — private)" : ""}</strong>
            <span class="mono">\${esc(m.created_at)}</span>
          </div>
          <div class="msg-body">\${esc(m.body)}</div>
        </div>
      \`).join("")}
    </div>

    <div class="card">
      <div class="row" style="justify-content:space-between; margin-bottom:8px">
        <strong>Reply to ticket</strong>
        <label class="row" style="font-size:12.5px; color:var(--muted)">
          <input type="checkbox" id="internal-toggle"> Private internal note (hidden from customer)
        </label>
      </div>
      <textarea id="reply-body" placeholder="Write your response…"></textarea>
      <div class="row" style="margin-top:10px">
        <button class="mint" id="send-reply-btn">Send Reply</button>
        <button id="send-resolve-btn">Send &amp; Mark Resolved</button>
      </div>
    </div>
  \`;

  $("status-select").value = t.status;
  $("priority-select").value = t.priority;

  if (atts.length) {
    const attRow = $("att-row");
    atts.forEach((a) => {
      const btn = document.createElement("button");
      btn.className = "mono";
      btn.textContent = "📎 " + a.filename + " (" + Math.max(1, Math.round(a.size_bytes / 1024)) + " KB)";
      btn.onclick = () => downloadAttachment(a.id, a.filename);
      attRow.appendChild(btn);
    });
  }

  async function saveMeta() {
    await api("/admin/api/tickets/" + encodeURIComponent(t.ticket_code), {
      method: "PATCH",
      body: JSON.stringify({ status: $("status-select").value, priority: $("priority-select").value }),
    });
    $("detail-msg").textContent = "Updated ticket status/priority.";
    loadTickets();
  }
  $("status-select").onchange = saveMeta;
  $("priority-select").onchange = saveMeta;

  async function sendReply(markResolved) {
    const body = $("reply-body").value.trim();
    if (!body) return;
    const internal = $("internal-toggle").checked;
    await api("/admin/api/tickets/" + encodeURIComponent(t.ticket_code) + "/reply", {
      method: "POST",
      body: JSON.stringify({
        body,
        internal,
        status: internal ? undefined : (markResolved ? "resolved" : "waiting_on_customer"),
      }),
    });
    await selectTicket(t.ticket_code);
  }
  $("send-reply-btn").onclick = () => sendReply(false);
  $("send-resolve-btn").onclick = () => sendReply(true);
}

async function boot() {
  try {
    await loadTickets();
    $("auth-view").classList.add("hidden");
    $("inbox-view").classList.remove("hidden");
    $("header-actions").classList.remove("hidden");
  } catch (err) {
    sessionStorage.removeItem("oopsi_admin_token");
    $("auth-view").classList.remove("hidden");
    $("inbox-view").classList.add("hidden");
    $("header-actions").classList.add("hidden");
    $("auth-msg").textContent = err.message;
    $("auth-msg").className = "status-msg err";
  }
}

$("connect-btn").onclick = () => {
  token = $("token-input").value.trim();
  if (!token) return;
  sessionStorage.setItem("oopsi_admin_token", token);
  boot();
};
$("signout-btn").onclick = () => {
  sessionStorage.removeItem("oopsi_admin_token");
  token = "";
  location.reload();
};
$("refresh-btn").onclick = () => {
  loadTickets();
  if (selectedCode) selectTicket(selectedCode);
};
$("search-input").oninput = () => loadTickets();
$("filter-tabs").querySelectorAll("button").forEach((btn) => {
  btn.onclick = () => {
    activeStatus = btn.dataset.status;
    $("filter-tabs").querySelectorAll("button").forEach((b) => b.classList.toggle("active", b === btn));
    loadTickets();
  };
});

if (token) boot();
</script>
</body>
</html>`;
}
