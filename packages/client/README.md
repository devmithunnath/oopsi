# `@oopsi/client`

Zero-dependency universal JavaScript/TypeScript client for [Oopsi](https://github.com/devmithunnath/oopsi) — works in browsers, Cloudflare Pages, React Native, Expo, Electron, and Node.

```ts
import { OopsiClient } from "@oopsi/client";

const client = new OopsiClient({ apiUrl: "https://support.yourapp.com" });
const res = await client.createTicket({
  email: "user@example.com",
  subject: "Export issue",
  message: "Stuck at 90%.",
});
console.log(res.ticket_code, res.ticket_url);
```
