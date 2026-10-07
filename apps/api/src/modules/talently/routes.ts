import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { parseOrThrow } from "../../platform/errors.js";
import { ctxFrom } from "../../platform/ctx.js";
import { copyTemplateSchema, createJobSchema, templateBodySchema } from "./schemas.js";
import * as svc from "./service.js";

const idParams = z.object({ id: z.string().uuid() });

export async function talentlyRoutes(app: FastifyInstance) {
  app.get("/talently/ping", { config: { requires: "talently.jobs.view" } }, async (request) => ({
    module: "talently",
    ok: true,
    userId: request.user.id,
    tenantId: request.tenantId,
    role: request.role,
  }));

  // ---------- Templates ----------
  app.get("/talently/templates", { config: { requires: "talently.jobs.view" } }, async (request) => ({
    items: await svc.listTemplates(request.tenantId),
  }));

  app.get("/talently/templates/:id", { config: { requires: "talently.jobs.view" } }, async (request) => {
    const { id } = parseOrThrow(idParams, request.params);
    return svc.getTemplate(request.tenantId, id);
  });

  app.post("/talently/templates", { config: { requires: "talently.jobs.manage" } }, async (request, reply) => {
    const body = parseOrThrow(templateBodySchema, request.body);
    return reply.code(201).send(await svc.createTemplate(ctxFrom(request), body));
  });

  app.put("/talently/templates/:id", { config: { requires: "talently.jobs.manage" } }, async (request) => {
    const { id } = parseOrThrow(idParams, request.params);
    const body = parseOrThrow(templateBodySchema, request.body);
    return svc.updateTemplate(ctxFrom(request), id, body);
  });

  app.post("/talently/templates/:id/copy", { config: { requires: "talently.jobs.manage" } }, async (request, reply) => {
    const { id } = parseOrThrow(idParams, request.params);
    const body = parseOrThrow(copyTemplateSchema, request.body ?? {});
    return reply.code(201).send(await svc.copyTemplate(ctxFrom(request), id, body.name));
  });

  // ---------- Jobs ----------
  app.get("/talently/jobs", { config: { requires: "talently.jobs.view" } }, async (request) => ({
    items: await svc.listJobs(request.tenantId),
  }));

  app.get("/talently/jobs/:id", { config: { requires: "talently.jobs.view" } }, async (request) => {
    const { id } = parseOrThrow(idParams, request.params);
    return svc.getJob(request.tenantId, id);
  });

  app.post("/talently/jobs", { config: { requires: "talently.jobs.manage" } }, async (request, reply) => {
    const body = parseOrThrow(createJobSchema, request.body);
    return reply.code(201).send(await svc.createJob(ctxFrom(request), body));
  });

  app.post("/talently/jobs/:id/publish", { config: { requires: "talently.jobs.manage" } }, async (request) => {
    const { id } = parseOrThrow(idParams, request.params);
    return svc.publishJob(ctxFrom(request), id);
  });

  app.post("/talently/jobs/:id/close", { config: { requires: "talently.jobs.manage" } }, async (request) => {
    const { id } = parseOrThrow(idParams, request.params);
    return svc.closeJob(ctxFrom(request), id);
  });

  // ---------- Step 6: public portal route (no sign-in, no tenant, no permission) ----------
  app.get("/portal/jobs/:id", async (request) => {
    const { id } = parseOrThrow(idParams, request.params);
    return svc.getPublicJob(id);
  });
}