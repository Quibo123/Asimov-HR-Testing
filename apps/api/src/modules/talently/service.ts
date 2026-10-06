import type { FastifyRequest } from "fastify";

export async function ping(request: FastifyRequest) {
  return {
    module: "talently",
    ok: true,
    userId: request.user?.id,
    tenantId: request.tenantId,
    role: request.role,
  };
}