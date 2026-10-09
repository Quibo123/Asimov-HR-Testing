import "dotenv/config";
import { prisma } from "../platform/prisma.js";
import { runApprovalSweep } from "../platform/approvals/service.js";

runApprovalSweep()
  .then(() => console.log("sweep done"))
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());