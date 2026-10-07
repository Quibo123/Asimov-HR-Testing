import type { FastifyRequest } from "fastify";
import type { Role } from "./auth.js";

export type Ctx = { tenantId: string; actorId: string; role: Role };

export const ctxFrom = (r: FastifyRequest): Ctx => ({
  tenantId: r.tenantId,
  actorId: r.user.id,
  role: r.role,
});