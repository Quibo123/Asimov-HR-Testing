import { Prisma } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { z } from "zod";
import { AppError } from "./errors.js";
import { parseTrustProxy } from "./env.js";
import { toHttpError } from "./errorHandler.js";
import type { RouteInfo } from "../app.js";

describe("errors are safe and use the right status", () => {
  it("keeps the status of errors we throw on purpose", () => {
    expect(toHttpError(new AppError(404, "Job not found."))).toEqual({
      statusCode: 404,
      error: "Not Found",
      message: "Job not found.",
    });
    expect(toHttpError(new AppError(403, "No.")).statusCode).toBe(403);
  });

  it("turns Zod errors into 400", () => {
    const result = z.object({ name: z.string() }).safeParse({});
    if (result.success) throw new Error("expected a failure");
    const mapped = toHttpError(result.error);
    expect(mapped.statusCode).toBe(400);
    expect(mapped.message).toContain("name");
  });

  it("maps database errors", () => {
    const known = (code: string) => new Prisma.PrismaClientKnownRequestError("db message", { code, clientVersion: "test" });
    expect(toHttpError(known("P2025")).statusCode).toBe(404);
    expect(toHttpError(known("P2002")).statusCode).toBe(409);
    expect(toHttpError(known("P2003")).statusCode).toBe(409);
    expect(toHttpError(known("P2028")).statusCode).toBe(503);
    expect(toHttpError(new Prisma.PrismaClientInitializationError("cannot reach", "test", "P1001")).statusCode).toBe(503);
  });

  it("passes through client errors from Fastify and plugins", () => {
    const badJson = Object.assign(new Error("Body is not valid JSON"), { statusCode: 400 });
    expect(toHttpError(badJson)).toMatchObject({ statusCode: 400, message: "Body is not valid JSON" });
    const limited = { statusCode: 429, error: "Too Many Requests", message: "slow down" };
    expect(toHttpError(limited)).toMatchObject({ statusCode: 429, message: "slow down" });
  });

  it("never shows the details of a bug", () => {
    const bug = toHttpError(new Error("connect ECONNREFUSED 10.0.0.5:5432 password=hunter2"));
    expect(bug.statusCode).toBe(500);
    expect(bug.message).not.toContain("hunter2");

    const server = toHttpError(Object.assign(new Error("secret detail"), { statusCode: 502 }));
    expect(server.statusCode).toBe(500);
    expect(server.message).not.toContain("secret");
  });
});

describe("parseTrustProxy", () => {
  it("understands false, true and a number of hops", () => {
    expect(parseTrustProxy(undefined)).toBe(false);
    expect(parseTrustProxy("false")).toBe(false);
    expect(parseTrustProxy("true")).toBe(true);
    expect(parseTrustProxy("1")).toBe(1);
    expect(parseTrustProxy("0")).toBe(false);
    expect(parseTrustProxy("abc")).toBe(false);
  });
});

describe("the real app", () => {
  const routes: RouteInfo[] = [];
  let app: { ready: () => Promise<unknown>; close: () => Promise<unknown>; inject: (o: { url: string }) => Promise<{ statusCode: number; body: string; json: () => unknown }> };

  beforeAll(async () => {
    // Harmless dummy values so the app can be built without a real database or Supabase.
    process.env.SUPABASE_URL ??= "https://example.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY ??= "test-key";
    process.env.DATABASE_URL ??= "postgresql://user:pass@localhost:5432/test";
    process.env.DIRECT_URL ??= "postgresql://user:pass@localhost:5432/test";
    const { buildApp } = await import("../app.js");
    app = await buildApp({ routeLog: routes, logger: false });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  const isPublic = (url: string) => url === "/health" || url === "/health/ready" || url.startsWith("/portal/");

  it("registers the routes", () => {
    expect(routes.length).toBeGreaterThan(20);
  });

  it("every route that is not public declares a permission", () => {
    const missing = routes
      .filter((r) => r.method !== "OPTIONS" && !isPublic(r.url) && !r.requires)
      .map((r) => `${r.method} ${r.url}`);
    expect(missing).toEqual([]);
  });

  it("/health answers 200", async () => {
    const res = await app.inject({ url: "/health" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: "ok" });
  });

  it("a protected route refuses a request without a token, without leaking details", async () => {
    const res = await app.inject({ url: "/talently/jobs" });
    expect(res.statusCode).toBe(401);
    expect(res.body).not.toMatch(/prisma|node_modules/i);
  });
});