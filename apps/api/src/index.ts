import "dotenv/config";
import { buildApp } from "./app.js";
import { assertEnv } from "./platform/env.js";
import { prisma } from "./platform/prisma.js";
import { startQueue, stopQueue } from "./platform/queue.js";
import { registerAllWorkers } from "./workers.js";

// RUN_WORKERS=true is for local development only: the workers run inside this process.
// On Render the workers run in their own service (see worker.ts).
const runWorkersInline = process.env.RUN_WORKERS === "true";
assertEnv("web", { alsoWorker: runWorkersInline });

const app = await buildApp();

// The web service starts the queue so it can add jobs (scoring, emails).
try {
  await startQueue();
  if (runWorkersInline) await registerAllWorkers();
} catch (err) {
  app.log.error({ err }, "pg-boss failed to start: applications will return 503 until it works");
}

app.addHook("onClose", async () => {
  await stopQueue();
  await prisma.$disconnect();
});

await app.listen({ port: Number(process.env.PORT) || 3000, host: "0.0.0.0" });

// Render stops the old version with SIGTERM during a deploy: finish open requests, then exit.
for (const signal of ["SIGTERM", "SIGINT"] as const) {
  process.on(signal, () => {
    app.log.info({ signal }, "shutting down");
    app.close().then(
      () => process.exit(0),
      () => process.exit(1),
    );
  });
}