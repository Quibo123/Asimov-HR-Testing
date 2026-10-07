import type { FastifyInstance } from "fastify";
import { ping } from "./service.js";

export async function timeRoutes(app: FastifyInstance) {
  app.get("/time/ping", { config: { requires: "time.view" } }, async () => ping());
}
