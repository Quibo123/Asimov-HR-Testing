import {
  registerApprovalWorkers,
  registerNotificationWorker,
  registerScoreWorker,
} from "./platform/queue.js";
import { dispatchApprovalDecided } from "./platform/approvals/events.js";
import { runApprovalSweep } from "./platform/approvals/service.js";
import { requeueStuckEmails, sendNotificationEmail } from "./platform/notifications/service.js";
import { runScoring } from "./modules/talently/scoring/runScoring.js";

// Handlers that react to approval.decided must be registered in the worker process,
// because the worker is the one that delivers that event.
export async function registerAllWorkers() {
  await registerScoreWorker(runScoring);
  await registerApprovalWorkers({
    onDecided: dispatchApprovalDecided,
    // The 10-minute sweep also re-queues notification emails that never got queued.
    onSweep: async () => {
      await runApprovalSweep();
      await requeueStuckEmails();
    },
  });
  await registerNotificationWorker(sendNotificationEmail);
}

import "dotenv/config";
import { assertEnv } from "./platform/env.js";
import { prisma } from "./platform/prisma.js";
import { startQueue, stopQueue } from "./platform/queue.js";

assertEnv("worker");

await startQueue();
await registerAllWorkers();
console.log(JSON.stringify({ msg: "worker.started", env: process.env.NODE_ENV ?? "development" }));

async function shutdown(signal: string) {
  console.log(JSON.stringify({ msg: "worker.stopping", signal }));
  try {
    await stopQueue(); // lets a job that is running finish
    await prisma.$disconnect();
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));