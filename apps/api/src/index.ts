import "dotenv/config";
import Fastify from "fastify";
import { registerAuthHook } from "./platform/auth.js";
import { talentlyRoutes } from "./modules/talently/routes.js";
import { coreRoutes } from "./modules/core/routes.js";
import { onboardRoutes } from "./modules/onboard/routes.js";
import { timeRoutes } from "./modules/time/routes.js";

const app = Fastify({ logger: true });

// Auth hook routes-ku MUNNADHI irukkanum, illana routes-ku apply aagaadhu
registerAuthHook(app);

app.get("/health", async () => ({ status: "ok" }));
app.register(talentlyRoutes);
app.register(coreRoutes);
app.register(onboardRoutes);
app.register(timeRoutes);

app.listen({ port: Number(process.env.PORT) || 3000, host: "0.0.0.0" });