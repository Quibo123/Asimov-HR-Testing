import type { FastifyInstance } from "fastify";
import { ping } from "./service.js";

export async function onboardRoutes(app: FastifyInstance) {
  app.get("/onboard/ping", async () => ping());
}
