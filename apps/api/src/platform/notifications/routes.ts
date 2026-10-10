import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { parseOrThrow } from "../errors.js";
import { ctxFrom } from "../ctx.js";
import * as svc from "./service.js";

const idParams = z.object({ id: z.string().uuid() });
const listQuery = z.object({
  unread: z.enum(["true", "false"]).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(30),
});

export async function notificationRoutes(app: FastifyInstance) {
  // My notifications (newest first) and how many are unread.
  app.get("/notifications", { config: { requires: "authenticated" } }, async (request) => {
    const query = parseOrThrow(listQuery, request.query);
    return svc.listNotifications(ctxFrom(request), {
      unreadOnly: query.unread === "true",
      limit: query.limit,
    });
  });

  // Mark one as read. Repeating it is harmless.
  app.post("/notifications/:id/read", { config: { requires: "authenticated" } }, async (request) => {
    const { id } = parseOrThrow(idParams, request.params);
    return svc.markRead(ctxFrom(request), id);
  });

  app.post("/notifications/read-all", { config: { requires: "authenticated" } }, async (request) =>
    svc.markAllRead(ctxFrom(request)),
  );
}