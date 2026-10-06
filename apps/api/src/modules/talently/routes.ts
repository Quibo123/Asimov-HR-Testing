import type { FastifyInstance } from "fastify";
import { ping } from "./service.js";

export async function talentlyRoutes(app: FastifyInstance) {
  app.get("/talently/ping", async (request) => ping(request));
}