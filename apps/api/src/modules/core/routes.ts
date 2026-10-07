import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import { parseOrThrow } from "../../platform/errors.js";
import { listAudit } from "../../platform/audit.js";
import {
  ping,
  listMembers,
  updateMemberRole,
  removeMember,
  type Ctx,
} from "./service.js";

const idParams = z.object({ id: z.string().uuid() });
const roleBody = z.object({ role: z.enum(["OWNER", "ADMIN", "MEMBER"]) });
const auditQuery = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
  entity: z.string().optional(),
  entityId: z.string().optional(),
});

const ctxFrom = (r: FastifyRequest): Ctx => ({
  tenantId: r.tenantId,
  actorId: r.user.id,
  role: r.role,
});

export async function coreRoutes(app: FastifyInstance) {
  app.get("/core/ping", { config: { requires: "authenticated" } }, async () => ping());

  app.get("/core/members", { config: { requires: "core.members.view" } }, async (request) => ({
    items: await listMembers(request.tenantId),
  }));

  app.patch("/core/members/:id", { config: { requires: "core.members.manage" } }, async (request) => {
    const { id } = parseOrThrow(idParams, request.params);
    const { role } = parseOrThrow(roleBody, request.body);
    return updateMemberRole(ctxFrom(request), id, role);
  });

  app.delete("/core/members/:id", { config: { requires: "core.members.manage" } }, async (request, reply) => {
    const { id } = parseOrThrow(idParams, request.params);
    await removeMember(ctxFrom(request), id);
    return reply.code(204).send();
  });

  // Read-only. No POST / PATCH / PUT / DELETE for audit entries. Ever.
  app.get("/core/audit", { config: { requires: "audit.view" } }, async (request) => {
    const q = parseOrThrow(auditQuery, request.query);
    return { items: await listAudit(request.tenantId, q) };
  });
}