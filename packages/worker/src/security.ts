const ALLOWED_EXTENSIONS = new Set([
  "png",
  "jpg",
  "jpeg",
  "webp",
  "gif",
  "txt",
  "log",
  "json",
  "zip",
  "pdf",
  "md",
  "csv",
]);

const EXTENSION_MIME_MAP: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
  txt: "text/plain; charset=utf-8",
  log: "text/plain; charset=utf-8",
  json: "application/json",
  zip: "application/zip",
  pdf: "application/pdf",
  md: "text/plain; charset=utf-8",
  csv: "text/csv; charset=utf-8",
};

export function constantTimeEqual(a: string, b: string): boolean {
  const aBytes = new TextEncoder().encode(a);
  const bBytes = new TextEncoder().encode(b);
  if (aBytes.length !== bBytes.length) return false;
  let diff = 0;
  for (let i = 0; i < aBytes.length; i++) {
    diff |= aBytes[i] ^ bBytes[i];
  }
  return diff === 0;
}

export function generateRandomHex(byteLength = 32): string {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function hashIdentifier(input: string, salt = "oopsi-rl-v1"): Promise<string> {
  const data = new TextEncoder().encode(`${salt}:${input}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

export function sanitizeFilename(raw: string): string {
  const base = raw.split(/[\\/]/).pop()?.trim() || "attachment.bin";
  const cleaned = base.replace(/[^a-zA-Z0-9._-]/g, "_").replace(/^\.+/, "");
  return (cleaned || "attachment.bin").slice(0, 120);
}

export function validateAttachmentFile(
  filename: string,
  sizeBytes: number,
  maxBytes: number,
): { ok: true; safeName: string; contentType: string } | { ok: false; error: string } {
  if (sizeBytes <= 0) {
    return { ok: false, error: "Attachment file is empty." };
  }
  if (sizeBytes > maxBytes) {
    const mb = (maxBytes / (1024 * 1024)).toFixed(0);
    return { ok: false, error: `Attachment exceeds maximum size of ${mb} MB.` };
  }
  const safeName = sanitizeFilename(filename);
  const ext = safeName.includes(".") ? safeName.split(".").pop()!.toLowerCase() : "";
  if (!ext || !ALLOWED_EXTENSIONS.has(ext)) {
    return {
      ok: false,
      error: "Unsupported file type. Allowed: png, jpg, webp, gif, txt, log, json, zip, pdf, md, csv.",
    };
  }
  return {
    ok: true,
    safeName,
    contentType: EXTENSION_MIME_MAP[ext] ?? "application/octet-stream",
  };
}

export function attachmentSecurityHeaders(filename: string, contentType: string, sizeBytes: number): Headers {
  const headers = new Headers();
  headers.set("Content-Type", contentType);
  headers.set("Content-Length", String(sizeBytes));
  headers.set("Content-Disposition", `attachment; filename="${sanitizeFilename(filename)}"`);
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Content-Security-Policy", "default-src 'none'; sandbox");
  headers.set("Cache-Control", "private, no-store");
  return headers;
}
