import assert from "node:assert/strict";
import test from "node:test";
import { OopsiApiError, OopsiClient } from "../src/index.ts";

test("OopsiClient sends JSON tickets, multipart attachments, and surfaces OopsiApiError", async () => {
  const seen: Array<{ url: string; method: string; isFormData: boolean }> = [];
  const mockFetch: typeof fetch = async (input, init) => {
    seen.push({
      url: String(input),
      method: init?.method ?? "GET",
      isFormData: init?.body instanceof FormData,
    });
    if (String(input).endsWith("/api/tickets") && init?.method === "POST") {
      return new Response(
        JSON.stringify({
          ticket_code: "OPS-1001",
          access_token: "tok_abc1234567890123",
          ticket_url: "https://example.com/support/ticket?t=tok_abc1234567890123",
          status: "open",
        }),
        { status: 201 },
      );
    }
    return new Response(JSON.stringify({ error: "Ticket not found." }), { status: 404 });
  };

  const client = new OopsiClient({ apiUrl: "https://support.example.com/", fetch: mockFetch });
  const created = await client.createTicket({
    email: "dev@example.com",
    subject: "Help!",
    message: "Something broke.",
  });
  assert.equal(created.ticket_code, "OPS-1001");
  assert.equal(seen[0].isFormData, false);

  await client.createTicket({
    email: "dev@example.com",
    subject: "With log",
    message: "Attached log",
    attachment: new Blob(["log content"], { type: "text/plain" }),
    attachmentName: "app.log",
  });
  assert.equal(seen[1].isFormData, true);

  await assert.rejects(() => client.getTicket("missing_token_123456"), (err: unknown) => {
    assert.ok(err instanceof OopsiApiError);
    assert.equal(err.status, 404);
    return true;
  });
});
