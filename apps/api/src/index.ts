import "dotenv/config";
import Fastify from "fastify";
import { talentlyRoutes } from "./modules/talently/routes.js";
import { coreRoutes } from "./modules/core/routes.js";
import { onboardRoutes } from "./modules/onboard/routes.js";
import { timeRoutes } from "./modules/time/routes.js";

const app = Fastify({ logger: true });

app.get("/health", async () => ({ status: "ok" }));
app.register(talentlyRoutes);
app.register(coreRoutes);
app.register(onboardRoutes);
app.register(timeRoutes);

app.listen({ port: Number(process.env.PORT) || 3000, host: "0.0.0.0" });