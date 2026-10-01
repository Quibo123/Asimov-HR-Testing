import type { FastifyInstance } from "fastify";
import { ping } from "./service.js";

export async function coreRoutes(app: FastifyInstance) {
  app.get("/core/ping", async () => ping());
}
