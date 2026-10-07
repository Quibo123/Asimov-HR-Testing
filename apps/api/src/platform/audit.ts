import { prisma, type Prisma, type Tx } from "./prisma.js";
import { forTenant } from "./for-tenant.js";
import { maskSensitive } from "./mask.js";

export type AuditInput = {
  tenantId: string;
  actorId: string;
  action: string;   // "<entity>.<verb>", e.g. "member.removed"
  entity: string;   // model name, e.g. "Membership"
  entityId: string;
  before?: unknown; // omit on create
  after?: unknown;  // omit on delete
};

function toJson(value: unknown): Prisma.InputJsonValue | undefined {
  if (value === undefined || value === null) return undefined; // stored as NULL
  // JSON round-trip turns Dates into strings and makes it plain data,
  // then Step 5 masks sensitive fields. Masking lives HERE so no caller can forget it.
  return maskSensitive(JSON.parse(JSON.stringify(value))) as Prisma.InputJsonValue;
}

/**
 * Write one audit entry.
 * It REQUIRES a transaction client (`tx`), so the entry is saved in the SAME
 * database transaction as the change itself: both succeed or both roll back.
 */
async function record(tx: Tx, input: AuditInput) {
  await tx.auditEntry.create({
    data: {
      tenantId: input.tenantId,
      actorId: input.actorId,
      action: input.action,
      entity: input.entity,
      entityId: input.entityId,
      before: toJson(input.before),
      after: toJson(input.after),
    },
  });
}

export const audit = { record };

// Read-only. There is deliberately NO update or delete function anywhere.
export async function listAudit(
  tenantId: string,
  opts: { limit: number; entity?: string; entityId?: string },
) {
  return prisma.auditEntry.findMany({
    where: {
      ...forTenant(tenantId),
      ...(opts.entity ? { entity: opts.entity } : {}),
      ...(opts.entityId ? { entityId: opts.entityId } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: opts.limit,
  });
}