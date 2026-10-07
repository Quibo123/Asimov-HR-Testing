import type { FastifyInstance } from "fastify";

export async function talentlyRoutes(app: FastifyInstance) {
  app.get(
    "/talently/ping",
    { config: { requires: "talently.jobs.view" } },
    async (request) => ({
      module: "talently",
      ok: true,
      userId: request.user.id,
      tenantId: request.tenantId,
      role: request.role,
    }),
  );
}