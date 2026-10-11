import Fastify from "fastify";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import { registerAuthHook } from "./platform/auth.js";
import { registerPermissionHook } from "./platform/permissions.js";
import { parseTrustProxy } from "./platform/env.js";
import { toHttpError } from "./platform/errorHandler.js";
import { prisma } from "./platform/prisma.js";
import { approvalRoutes } from "./platform/approvals/routes.js";
import { notificationRoutes } from "./platform/notifications/routes.js";
import { talentlyRoutes } from "./modules/talently/routes.js";
import { coreRoutes } from "./modules/core/routes.js";
import { onboardRoutes } from "./modules/onboard/routes.js";
import { timeRoutes } from "./modules/time/routes.js";

export type RouteInfo = { method: string; url: string; requires: string | undefined };

export async function buildApp(opts: { routeLog?: RouteInfo[]; logger?: boolean } = {}) {
  const app = Fastify({
    logger: opts.logger ?? true,
    // Behind Render's proxy set TRUST_PROXY=1 so request.ip is the visitor's address.
    trustProxy: process.env.TRUST_PROXY === "true",
    bodyLimit: 1_048_576, // 1 MB
  });

  // Tests use this to list every route that gets registered.
  if (opts.routeLog) {
    const log = opts.routeLog;
    app.addHook("onRoute", (route) => {
      const methods = Array.isArray(route.method) ? route.method : [route.method];
      for (const method of methods) {
        log.push({ method, url: route.url, requires: route.config?.requires });
      }
    });
  }

  // Safe errors: expected problems become 400/403/404/409/429/503, bugs become a generic 500.
  app.setErrorHandler((error, request, reply) => {
    const mapped = toHttpError(error);
    if (mapped.statusCode >= 500) {
      request.log.error({ err: error, requestId: request.id }, "request failed");
      return reply
        .code(mapped.statusCode)
        .send(mapped.statusCode === 500 ? { ...mapped, requestId: request.id } : mapped);
    }
    return reply.code(mapped.statusCode).send(mapped);
  });

  app.setNotFoundHandler((request, reply) =>
    reply.code(404).send({
      statusCode: 404,
      error: "Not Found",
      message: `Route ${request.method}:${request.url.split("?")[0]} not found`,
    }),
  );

  const allowedOrigins = (process.env.CORS_ORIGINS ?? "http://localhost:5173")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  // CORS and the rate limiter are registered BEFORE the auth hook and the routes.
  await app.register(cors, {
    origin: allowedOrigins,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Authorization", "Content-Type", "X-Tenant-ID"],
    exposedHeaders: ["Retry-After"],
    maxAge: 86400,
  });

  // Default limit for every route: 300 requests per minute per IP (not for health checks).
  // Stricter limits are set on single routes (apply, upload-url).
  await app.register(rateLimit, {
    global: true,
    max: 300,
    timeWindow: "1 minute",
    allowList: (request) => request.url === "/health" || request.url === "/health/ready",
    errorResponseBuilder: (_request, context) => ({
      statusCode: 429,
      error: "Too Many Requests",
      message: `Too many requests from this connection. Please wait about ${Math.max(
        1,
        Math.ceil(context.ttl / 60000),
      )} minute(s) and try again.`,
    }),
  });

  registerAuthHook(app);       // 1. who are you? (401 / 403)
  registerPermissionHook(app); // 2. what may you do? (403)

  // Health: /health is instant and never touches the database (Render uses it).
  // /health/ready also checks the database (the smoke test uses it).
  app.get("/health", async () => ({ status: "ok" }));
  app.get("/health/ready", async (request, reply) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      return { status: "ok", database: "ok" };
    } catch (err) {
      request.log.error({ err }, "database check failed");
      return reply.code(503).send({ status: "degraded", database: "unreachable" });
    }
  });

  app.register(notificationRoutes);
  app.register(approvalRoutes);
  app.register(talentlyRoutes);
  app.register(coreRoutes);
  app.register(onboardRoutes);
  app.register(timeRoutes);

  return app;
}