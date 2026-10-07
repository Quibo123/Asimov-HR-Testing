import type { FastifyInstance } from "fastify";
import { isPublic, type Role } from "./auth.js";

// ---------- Step 1: permission strings + role map ----------

export const PERMISSIONS = [
  "talently.jobs.view",
  "talently.jobs.manage",
  "time.view",
  "time.submit",
  "time.approve",
  "core.members.view",
  "core.members.manage",
  "audit.view",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

// TypeScript forces every Role to have an entry here.
// REPLACE the lists below with your real permission table.
export const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  OWNER: [...PERMISSIONS],
  ADMIN: [...PERMISSIONS],
  MEMBER: [
    "talently.jobs.view",
    "time.view",
    "time.submit",
    "core.members.view",
  ],
};

export function can(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

// ---------- Step 2: the `requires` route option + 403 hook ----------

declare module "fastify" {
  interface FastifyContextConfig {
    // A permission string, or "authenticated" for routes that only need a valid user + tenant.
    requires?: Permission | "authenticated";
  }
}

export function registerPermissionHook(app: FastifyInstance) {
  app.addHook("onRequest", async (request, reply) => {
    if (request.is404) return; // unknown URL: let Fastify answer 404
    const path = request.url.split("?")[0];
    if (isPublic(path)) return; // /health and public portal routes

    const requires = request.routeOptions.config?.requires;

    // Fail closed: a route that forgot to declare `requires` is blocked.
    if (!requires) {
      request.log.error({ url: request.url }, "route has no `requires` option");
      return reply.code(403).send({
        error: "Forbidden",
        message: "This route has no permission declared.",
      });
    }

    if (requires === "authenticated") return;

    if (!can(request.role, requires)) {
      return reply.code(403).send({
        error: "Forbidden",
        message: `Your role (${request.role}) does not have permission: ${requires}.`,
      });
    }
  });
}