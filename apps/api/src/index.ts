import "dotenv/config";
import Fastify from "fastify";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import { registerAuthHook } from "./platform/auth.js";
import { registerPermissionHook } from "./platform/permissions.js";
import {
  startQueue,
  stopQueue,
  registerScoreWorker,
  registerApprovalWorkers,
  registerNotificationWorker,
} from "./platform/queue.js";
import { dispatchApprovalDecided } from "./platform/approvals/events.js";
import { runApprovalSweep } from "./platform/approvals/service.js";
import { approvalRoutes } from "./platform/approvals/routes.js";
import { requeueStuckEmails, sendNotificationEmail } from "./platform/notifications/service.js";
import { notificationRoutes } from "./platform/notifications/routes.js";
import { runScoring } from "./modules/talently/scoring/runScoring.js";
import { talentlyRoutes } from "./modules/talently/routes.js";
import { coreRoutes } from "./modules/core/routes.js";
import { onboardRoutes } from "./modules/onboard/routes.js";
import { timeRoutes } from "./modules/time/routes.js";

const app = Fastify({
  logger: true,
  // Behind a proxy (Render, Railway, ...) set TRUST_PROXY=true so request.ip is the visitor's IP.
  trustProxy: process.env.TRUST_PROXY === "true",
});

const allowedOrigins = (process.env.CORS_ORIGINS ?? "http://localhost:5173")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

// Register CORS and the rate limiter BEFORE the auth hook and the routes.
await app.register(cors, {
  origin: allowedOrigins,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Authorization", "Content-Type", "X-Tenant-ID"],
  exposedHeaders: ["Retry-After"],
  maxAge: 86400,
});

await app.register(rateLimit, {
  global: false,
  errorResponseBuilder: (_request, context) => ({
    statusCode: 429,
    error: "Too Many Requests",
    message: `You have made too many submissions from this connection. Please wait about ${Math.max(
      1,
      Math.ceil(context.ttl / 60000),
    )} minute(s) and try again.`,
  }),
});

registerAuthHook(app);       // 1. who are you? (401 / 403)
registerPermissionHook(app); // 2. what may you do? (403)

app.get("/health", async () => ({ status: "ok" }));
app.register(notificationRoutes);
app.register(approvalRoutes);
app.register(talentlyRoutes);
app.register(coreRoutes);
app.register(onboardRoutes);
app.register(timeRoutes);

// Start the job queue and its workers.
// If this fails, the server still starts, but "apply" answers 503 and emails wait.
try {
  await startQueue();
  await registerScoreWorker(runScoring);
  await registerApprovalWorkers({
    onDecided: dispatchApprovalDecided,
    // The 10-minute sweep also re-queues notification emails that never got queued.
    onSweep: async () => {
      await runApprovalSweep();
      await requeueStuckEmails();
    },
  });
  await registerNotificationWorker(sendNotificationEmail);
  app.addHook("onClose", async () => {
    await stopQueue();
  });
} catch (err) {
  app.log.error({ err }, "pg-boss failed to start: applications will return 503 until it works");
}

app.listen({ port: Number(process.env.PORT) || 3000, host: "0.0.0.0" });