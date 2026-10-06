import type { FastifyInstance } from "fastify";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { prisma } from "./prisma.js";

export type Role = "OWNER" | "ADMIN" | "MEMBER";
export type AuthUser = { id: string; email: string | undefined };

declare module "fastify" {
  interface FastifyRequest {
    user: AuthUser | null;
    tenantId: string;
    role: Role | null;
  }
}

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

const tenantIdSchema = z.string().uuid();

// Token illaama pogalaam: health + public portal routes
const PUBLIC_EXACT = new Set(["/health"]);
const PUBLIC_PREFIXES = ["/public/"]; // unga real public portal path ku maathunga

function isPublic(path: string) {
  return PUBLIC_EXACT.has(path) || PUBLIC_PREFIXES.some((p) => path.startsWith(p));
}

export function registerAuthHook(app: FastifyInstance) {
  app.decorateRequest("user", null);
  app.decorateRequest("tenantId", "");
  app.decorateRequest("role", null);

  app.addHook("onRequest", async (request, reply) => {
    const path = request.url.split("?")[0];
    if (isPublic(path)) return;

    // ---- Step 2: token edukkurom, Supabase kitta verify panrom ----
    const header = request.headers.authorization;
    const token = header?.startsWith("Bearer ") ? header.slice(7).trim() : null;

    if (!token) {
      return reply.code(401).send({
        error: "Unauthorized",
        message: "Missing Authorization: Bearer <token> header.",
      });
    }

    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data.user) {
      return reply.code(401).send({
        error: "Unauthorized",
        message: "Invalid or expired token.",
      });
    }

    // ---- Step 3: Membership lookup ----
    const memberships = await prisma.membership.findMany({
      where: { userId: data.user.id },
      select: { tenantId: true, role: true },
    });

    if (memberships.length === 0) {
      return reply.code(403).send({
        error: "Forbidden",
        message: "You do not belong to any tenant.",
      });
    }

    // X-Tenant-ID ippo "trust" illa. User choose panra tenant mattum, adhai membership vachu check panrom.
    const rawChoice = request.headers["x-tenant-id"];
    const choice = Array.isArray(rawChoice) ? rawChoice[0] : rawChoice;

    let membership: (typeof memberships)[number] | undefined;

    if (choice !== undefined) {
      if (!tenantIdSchema.safeParse(choice).success) {
        return reply.code(400).send({
          error: "Bad Request",
          message: "X-Tenant-ID must be a valid tenant UUID.",
        });
      }
      membership = memberships.find((m) => m.tenantId === choice);
      if (!membership) {
        // ---- Step 5: user illaadha tenant ku 403 ----
        return reply.code(403).send({
          error: "Forbidden",
          message: "You are not a member of this tenant.",
        });
      }
    } else if (memberships.length === 1) {
      membership = memberships[0]; // oru tenant dhaan, so auto
    } else {
      return reply.code(400).send({
        error: "Bad Request",
        message: "You belong to multiple tenants. Send X-Tenant-ID to choose one.",
      });
    }

    // ---- Step 4: request la attach panrom ----
    request.user = { id: data.user.id, email: data.user.email };
    request.tenantId = membership.tenantId;
    request.role = membership.role;
  });
}