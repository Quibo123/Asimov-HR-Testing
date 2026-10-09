import { PgBoss } from "pg-boss";
import { AppError } from "./errors.js";
import type { ApprovalDecidedEvent } from "./approvals/events.js";

export const QUEUES = {
  score: "talently.score",
  approvalDecided: "approval.decided",
  approvalSweep: "approval.sweep",
} as const;

let boss: PgBoss | null = null;

export async function startQueue() {
  // pg-boss needs a normal (non-pooled) connection, so prefer DIRECT_URL.
  const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DIRECT_URL or DATABASE_URL is required for pg-boss.");

  boss = new PgBoss({ connectionString, max: 3 });
  boss.on("error", (err: unknown) => console.error("pg-boss error:", err));

  await boss.start(); // creates its own "pgboss" schema on first start
  await boss.createQueue(QUEUES.score);
  await boss.createQueue(QUEUES.approvalDecided);
  await boss.createQueue(QUEUES.approvalSweep);
}

export async function stopQueue() {
  await boss?.stop();
  boss = null;
}

export async function enqueueScore(applicationId: string) {
  if (!boss) throw new AppError(503, "The processing queue is not running.");
  await boss.send(
    QUEUES.score,
    { applicationId },
    { retryLimit: 3, retryDelay: 30, retryBackoff: true },
  );
}

export async function registerScoreWorker(handler: (applicationId: string) => Promise<void>) {
  if (!boss) throw new Error("The queue has not been started.");
  await boss.work<{ applicationId: string }>(QUEUES.score, async (jobs) => {
    // If the handler throws, pg-boss retries the job (retryLimit is set in enqueueScore).
    for (const job of jobs) {
      await handler(job.data.applicationId);
    }
  });
}

// ---------- Approvals ----------

export async function enqueueApprovalDecided(event: ApprovalDecidedEvent) {
  if (!boss) throw new AppError(503, "The processing queue is not running.");
  await boss.send(QUEUES.approvalDecided, event, {
    retryLimit: 5,
    retryDelay: 30,
    retryBackoff: true,
  });
}

export async function registerApprovalWorkers(opts: {
  onDecided: (event: ApprovalDecidedEvent) => Promise<void>;
  onSweep: () => Promise<void>;
}) {
  if (!boss) throw new Error("The queue has not been started.");

  await boss.work<ApprovalDecidedEvent>(QUEUES.approvalDecided, async (jobs) => {
    for (const job of jobs) {
      await opts.onDecided(job.data);
    }
  });

  await boss.work(QUEUES.approvalSweep, async () => {
    await opts.onSweep();
  });

  // The fallback timer: pg-boss scheduling runs the sweep every 10 minutes.
  await boss.schedule(QUEUES.approvalSweep, "*/10 * * * *");
}