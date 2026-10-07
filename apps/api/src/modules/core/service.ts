import { prisma, type Tx } from "../../platform/prisma.js";
import { forTenant } from "../../platform/for-tenant.js";
import { audit } from "../../platform/audit.js";
import { AppError } from "../../platform/errors.js";
import type { Role } from "../../platform/auth.js";

// Who is doing this, and in which tenant. Built from the request in routes.ts.
export type Ctx = { tenantId: string; actorId: string; role: Role };

export async function ping() {
  return { module: "core", ok: true };
}

export async function listMembers(tenantId: string) {
  return prisma.membership.findMany({
    where: { ...forTenant(tenantId) },
    select: {
      id: true,
      userId: true,
      role: true,
      createdAt: true,
      user: { select: { email: true } },
    },
    orderBy: { createdAt: "asc" },
  });
}

// ---------- Step 6 guard helpers ----------

// Lock this tenant's owner rows until the transaction ends, so two requests
// can't both demote "the other" owner at the same moment.
async function lockOwners(tx: Tx, tenantId: string) {
  await tx.$queryRaw`
    SELECT id FROM platform."Membership"
    WHERE "tenantId" = ${tenantId} AND role = 'OWNER'
    FOR UPDATE`;
}

// Call only when the target is currently an OWNER and is about to stop being one.
async function assertNotLastOwner(tx: Tx, tenantId: string) {
  const owners = await tx.membership.count({
    where: { ...forTenant(tenantId), role: "OWNER" },
  });
  if (owners <= 1) {
    throw new AppError(409, "A tenant must always keep at least one owner.");
  }
}

// Only an owner may touch owner roles (stops an ADMIN promoting themselves).
function assertOwnerRules(ctx: Ctx, currentRole: Role, newRole?: Role) {
  const touchesOwner = currentRole === "OWNER" || newRole === "OWNER";
  if (touchesOwner && ctx.role !== "OWNER") {
    throw new AppError(403, "Only an owner can change owner roles.");
  }
}

// ---------- Writes: change + audit entry in ONE transaction ----------

export async function updateMemberRole(ctx: Ctx, membershipId: string, newRole: Role) {
  return prisma.$transaction(async (tx) => {
    await lockOwners(tx, ctx.tenantId);

    const before = await tx.membership.findFirst({
      where: { id: membershipId, ...forTenant(ctx.tenantId) },
    });
    if (!before) throw new AppError(404, "Member not found.");
    if (before.role === newRole) return before; // nothing changed, so no audit entry

    assertOwnerRules(ctx, before.role, newRole);
    if (before.role === "OWNER") await assertNotLastOwner(tx, ctx.tenantId);

    const after = await tx.membership.update({
      where: { id: before.id, ...forTenant(ctx.tenantId) },
      data: { role: newRole },
    });

    await audit.record(tx, {
      tenantId: ctx.tenantId,
      actorId: ctx.actorId,
      action: "member.role_changed",
      entity: "Membership",
      entityId: after.id,
      before,
      after,
    });

    return after;
  });
}

export async function removeMember(ctx: Ctx, membershipId: string) {
  await prisma.$transaction(async (tx) => {
    await lockOwners(tx, ctx.tenantId);

    const before = await tx.membership.findFirst({
      where: { id: membershipId, ...forTenant(ctx.tenantId) },
    });
    if (!before) throw new AppError(404, "Member not found.");

    assertOwnerRules(ctx, before.role);
    if (before.role === "OWNER") await assertNotLastOwner(tx, ctx.tenantId);

    await tx.membership.delete({
      where: { id: before.id, ...forTenant(ctx.tenantId) },
    });

    await audit.record(tx, {
      tenantId: ctx.tenantId,
      actorId: ctx.actorId,
      action: "member.removed",
      entity: "Membership",
      entityId: before.id,
      before, // no `after`: the row is gone
    });
  });
}