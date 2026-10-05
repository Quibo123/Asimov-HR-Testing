import type { FastifyInstance } from "fastify";
import { z } from "zod";

// Teach TypeScript that every request carries a tenantId.
declare module "fastify" {
  interface FastifyRequest {
    tenantId: string;
  }
}

const tenantIdSchema = z.string().uuid();

// Steps 2 + 3 live together: read the tenant, reject if it's missing.
export function registerTenantHook(app: FastifyInstance) {
  // Reserve the property up front so Fastify keeps request objects fast and consistent.
  app.decorateRequest("tenantId", "");

  app.addHook("onRequest", async (request, reply) => {
    const path = request.url.split("?")[0];
    if (isPublic(path)) return; // Step 3 exceptions

    // TEMPORARY: header for now. After AS-106, read this from the sign-in token instead.
    const raw = request.headers["x-tenant-id"];
    const parsed = tenantIdSchema.safeParse(Array.isArray(raw) ? raw[0] : raw);

    if (!parsed.success) {
      return reply.code(400).send({
        error: "Bad Request",
        message: "Missing or invalid X-Tenant-ID header. Send a valid tenant UUID.",
      });
    }

    request.tenantId = parsed.data;
  });
}

// Step 3: routes that don't need a tenant.
const PUBLIC_EXACT = new Set(["/health"]);
const PUBLIC_PREFIXES = ["/public/"]; // assumption: adjust to your real public portal path

function isPublic(path: string) {
  return PUBLIC_EXACT.has(path) || PUBLIC_PREFIXES.some((p) => path.startsWith(p));
}