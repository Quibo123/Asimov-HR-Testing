import "dotenv/config";
import { randomUUID } from "node:crypto";
import { prisma } from "../platform/prisma.js";
import { createApprovalRequest } from "../platform/approvals/service.js";
import { createApprovalSchema } from "../platform/approvals/schemas.js";

// Usage: npx tsx src/dev/approval-create.ts <tenantId> <requesterUserId> <step> [<step> ...]
// A step is MANAGER, ROLE:ADMIN or PERSON:<user uuid>. Prints the new request id.
const [tenantId, requesterId, ...stepArgs] = process.argv.slice(2);

function parseStep(arg: string) {
  const [rule, value] = arg.split(":");
  if (rule === "MANAGER") return { rule: "MANAGER" as const };
  if (rule === "ROLE") return { rule: "ROLE" as const, role: value };
  if (rule === "PERSON") return { rule: "PERSON" as const, userId: value };
  throw new Error(`Unknown step: ${arg}`);
}

async function main() {
  if (!tenantId || !requesterId || stepArgs.length === 0) {
    throw new Error("Usage: npx tsx src/dev/approval-create.ts <tenantId> <requesterUserId> <step> [<step> ...]");
  }

  const membership = await prisma.membership.findFirst({
    where: { tenantId, userId: requesterId },
    select: { role: true },
  });
  if (!membership) throw new Error("The requester is not a member of that tenant.");

  const input = createApprovalSchema.parse({
    module: "demo",
    type: "demo_request",
    subjectEntity: "Demo",
    subjectId: randomUUID(),
    summary: "Test approval request",
    steps: stepArgs.map(parseStep),
  });

  const request = await createApprovalRequest(
    { tenantId, actorId: requesterId, role: membership.role },
    input,
  );
  console.log(request.id);
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());