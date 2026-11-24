import { createSupportWorker, discordNotifier, resendEmailAdapter } from "@oopsi/worker";

export default createSupportWorker({
  brandName: "MyApp",
  ticketPrefix: "OPS",
  portalBaseUrl: "https://myapp.pages.dev/support",
  allowedOrigins: ["https://myapp.pages.dev"],
  notifiers: [discordNotifier()],
  email: resendEmailAdapter({ from: "MyApp Support <support@myapp.com>" }),
});
