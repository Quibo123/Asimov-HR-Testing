import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { parseOrThrow } from "../errors.js";
import { ctxFrom } from "../ctx.js";
import { decideSchema, myRequestsQuery } from "./schemas.js";
import * as svc from "./service.js";

const idParams = z.object({ id: z.string().uuid() });

export async function approvalRoutes(app: FastifyInstance) {
  // My pending approvals: steps waiting for ME to decide.
  app.get("/approvals/pending", { config: { requires: "authenticated" } }, async (request) => ({
    items: await svc.listPending(ctxFrom(request)),
  }));

  // My requests: requests I made.
  app.get("/approvals/requests", { config: { requires: "authenticated" } }, async (request) => {
    const query = parseOrThrow(myRequestsQuery, request.query);
    return { items: await svc.listMine(ctxFrom(request), query) };
  });

  // One request with its steps (only for the requester or an approver).
  app.get("/approvals/requests/:id", { config: { requires: "authenticated" } }, async (request) => {
    const { id } = parseOrThrow(idParams, request.params);
    return svc.getRequest(ctxFrom(request), id);
  });

  // Decide: { "decision": "approve" | "reject", "reason": "..." }
  app.post("/approvals/requests/:id/decide", { config: { requires: "authenticated" } }, async (request) => {
    const { id } = parseOrThrow(idParams, request.params);
    const body = parseOrThrow(decideSchema, request.body);
    return svc.decideRequest(ctxFrom(request), id, body);
  });

  // Withdraw (requester only, while pending).
  app.post("/approvals/requests/:id/withdraw", { config: { requires: "authenticated" } }, async (request) => {
    const { id } = parseOrThrow(idParams, request.params);
    return svc.withdrawRequest(ctxFrom(request), id);
  });
}