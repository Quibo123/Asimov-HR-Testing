import "dotenv/config";
import { prisma } from "../platform/prisma.js";
import { startQueue, stopQueue } from "../platform/queue.js";
import { notify } from "../platform/notifications/service.js";

// Usage: npx tsx src/dev/notify-demo.ts <tenantId> <userId> <eventId> "<message>"
// The running server (npm run dev) picks up the queued email and sends it.
const [tenantId, userId, eventId, message] = process.argv.slice(2);

async function main() {
  if (!tenantId || !userId || !eventId || !message) {
    throw new Error('Usage: npx tsx src/dev/notify-demo.ts <tenantId> <userId> <eventId> "<message>"');
  }

  await startQueue(); // so the email job can be queued
  const result = await notify({
    eventId,
    tenantId,
    userId,
    type: "demo.notice",
    data: { message },
    link: "/approvals/demo-item",
  });
  console.log(JSON.stringify(result));
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await stopQueue();
    await prisma.$disconnect();
  });