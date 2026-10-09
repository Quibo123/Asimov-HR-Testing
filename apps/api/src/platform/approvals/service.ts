import type { ApprovalStep, Role } from "@prisma/client";
import { prisma, Prisma, type Tx } from "../prisma.js";
import { forTenant } from "../for-tenant.js";
import { audit } from "../audit.js";
import { AppError } from "../errors.js";
import type { Ctx } from "../ctx.js";
import { enqueueApprovalDecided } from "../queue.js";
import { getNumberSetting, getStringSetting, SETTING_KEYS } from "../settings.js";
import type { ApprovalDecidedEvent } from "./events.js";
import type { CreateApprovalInput, DecideInput, MyRequestsQuery } from "./schemas.js";

const DEFAULT_FALLBACK_HOURS = 48;

const withSteps = {
  steps: { orderBy: { position: "asc" } },
} satisfies Prisma.ApprovalRequestInclude;

// Row lock: two people deciding at the same moment are handled one after the other.
async function lockRequest(tx: Tx, id: string) {
  await tx.$queryRaw`SELECT id FROM platform."ApprovalRequest" WHERE id = ${id} FOR UPDATE`;
}

// ======================= Who may decide a step =======================

function isEligible(step: ApprovalStep, requesterId: string, userId: string, role: Role) {
  if (userId === requesterId) return false; // nobody decides their own request
  if (step.assignedUserId) return step.assignedUserId === userId; // one named person
  return step.approverRole !== null && step.approverRole === role; // anyone with the role
}

type Resolution = { ok: true; assignedUserId: string | null } | { ok: false; reason: string };

async function resolveApprover(
  tx: Tx,
  tenantId: string,
  requesterId: string,
  step: ApprovalStep,
): Promise<Resolution> {
  if (step.rule === "ROLE") {
    const count = await tx.membership.count({
      where: {
        ...forTenant(tenantId),
        role: step.approverRole ?? undefined,
        userId: { not: requesterId },
      },
    });
    return count > 0
      ? { ok: true, assignedUserId: null }
      : { ok: false, reason: `No member with the ${step.approverRole} role is available.` };
  }

  let userId: string | null;
  if (step.rule === "MANAGER") {
    const requester = await tx.membership.findFirst({
      where: { userId: requesterId, ...forTenant(tenantId) },
      select: { managerId: true },
    });
    userId = requester?.managerId ?? null;
    if (!userId) return { ok: false, reason: "The requester has no manager set." };
  } else {
    userId = step.approverUserId;
    if (!userId) return { ok: false, reason: "No approver is named for this step." };
  }

  if (userId === requesterId) return { ok: false, reason: "The approver is the requester." };

  const member = await tx.membership.findFirst({
    where: { userId, ...forTenant(tenantId) },
    select: { id: true },
  });
  if (!member) return { ok: false, reason: "The approver is no longer a member." };

  return { ok: true, assignedUserId: userId };
}

// ======================= Step 4: fallback approver =======================

type Fallback = { assignedUserId: string | null; approverRole: Role | null };

async function resolveFallback(
  tx: Tx,
  tenantId: string,
  requesterId: string,
): Promise<Fallback | null> {
  const fallbackUserId = await getStringSetting(tenantId, SETTING_KEYS.approvalFallbackUserId);
  if (fallbackUserId && fallbackUserId !== requesterId) {
    const member = await tx.membership.findFirst({
      where: { userId: fallbackUserId, ...forTenant(tenantId) },
      select: { id: true },
    });
    if (member) return { assignedUserId: fallbackUserId, approverRole: null };
  }

  // No usable fallback person is set: any owner other than the requester can decide.
  const owners = await tx.membership.count({
    where: { ...forTenant(tenantId), role: "OWNER", userId: { not: requesterId } },
  });
  return owners > 0 ? { assignedUserId: null, approverRole: "OWNER" } : null;
}

// Make a step the current one: find its approver, or go straight to the fallback.
async function activateStep(tx: Tx, tenantId: string, requesterId: string, step: ApprovalStep) {
  const now = new Date();
  const where = { id: step.id, ...forTenant(tenantId) };
  const resolved = await resolveApprover(tx, tenantId, requesterId, step);

  if (resolved.ok) {
    await tx.approvalStep.update({
      where,
      data: { status: "PENDING", activatedAt: now, assignedUserId: resolved.assignedUserId },
    });
    return;
  }

  const fallback = await resolveFallback(tx, tenantId, requesterId);
  if (fallback) {
    await tx.approvalStep.update({
      where,
      data: {
        status: "PENDING",
        activatedAt: now,
        assignedUserId: fallback.assignedUserId,
        approverRole: fallback.approverRole,
        escalatedAt: now,
        escalationNote: `Approver unavailable (${resolved.reason}) Moved to the fallback approver.`,
      },
    });
  } else {
    await tx.approvalStep.update({
      where,
      data: {
        status: "PENDING",
        activatedAt: now,
        assignedUserId: null,
        escalationNote: `No approver available: ${resolved.reason}`,
      },
    });
  }
}

// ======================= Step 2: create =======================

// Called by other modules in code. The caller decides the chain, never the end user.
export async function createApprovalRequest(ctx: Ctx, input: CreateApprovalInput) {
  return prisma.$transaction(async (tx) => {
    const requester = await tx.membership.findFirst({
      where: { userId: ctx.actorId, ...forTenant(ctx.tenantId) },
      select: { id: true },
    });
    if (!requester) throw new AppError(400, "The requester is not a member of this organisation.");

    const duplicate = await tx.approvalRequest.findFirst({
      where: {
        ...forTenant(ctx.tenantId),
        module: input.module,
        type: input.type,
        subjectEntity: input.subjectEntity,
        subjectId: input.subjectId,
        status: "PENDING",
      },
      select: { id: true },
    });
    if (duplicate) throw new AppError(409, "An approval for this item is already pending.");

    for (const [i, step] of input.steps.entries()) {
      if (step.rule !== "PERSON") continue;
      const member = await tx.membership.findFirst({
        where: { userId: step.userId, ...forTenant(ctx.tenantId) },
        select: { id: true },
      });
      if (!member) {
        throw new AppError(400, `Step ${i + 1}: the named approver is not a member of this organisation.`);
      }
    }

    const created = await tx.approvalRequest.create({
      data: {
        ...forTenant(ctx.tenantId),
        module: input.module,
        type: input.type,
        requesterId: ctx.actorId,
        subjectEntity: input.subjectEntity,
        subjectId: input.subjectId,
        summary: input.summary,
        steps: {
          create: input.steps.map((step, i) => ({
            ...forTenant(ctx.tenantId),
            position: i,
            rule: step.rule,
            approverRole: step.rule === "ROLE" ? step.role : null,
            approverUserId: step.rule === "PERSON" ? step.userId : null,
          })),
        },
      },
      include: withSteps,
    });

    // Resolve the first approver; the other steps wait their turn.
    await activateStep(tx, ctx.tenantId, ctx.actorId, created.steps[0]);

    const after = await tx.approvalRequest.findFirstOrThrow({
      where: { id: created.id, ...forTenant(ctx.tenantId) },
      include: withSteps,
    });
    await audit.record(tx, {
      tenantId: ctx.tenantId,
      actorId: ctx.actorId,
      action: "approval.requested",
      entity: "ApprovalRequest",
      entityId: after.id,
      after,
    });
    return after;
  });
}

// ======================= Steps 2 + 3: decide =======================

export async function decideRequest(ctx: Ctx, requestId: string, input: DecideInput) {
  const outcome = await prisma.$transaction(async (tx) => {
    await lockRequest(tx, requestId);

    const before = await tx.approvalRequest.findFirst({
      where: { id: requestId, ...forTenant(ctx.tenantId) },
      include: withSteps,
    });
    if (!before) throw new AppError(404, "Approval request not found.");

    // Rule: the requester can never approve (or reject) their own request.
    if (before.requesterId === ctx.actorId) {
      throw new AppError(403, "You cannot approve or reject your own request.");
    }

    const wanted = input.decision === "approve" ? "APPROVED" : "REJECTED";
    const current =
      before.status === "PENDING" ? before.steps.find((s) => s.status === "PENDING") : undefined;
    const canDecideNow =
      current !== undefined && isEligible(current, before.requesterId, ctx.actorId, ctx.role);

    if (!canDecideNow || !current) {
      // Rule: repeating a decision you already made returns the same result and writes nothing.
      const alreadyMine = before.steps.some(
        (s) => s.decidedById === ctx.actorId && s.status === wanted,
      );
      if (alreadyMine) return { request: before, repeated: true, final: false };

      if (before.status !== "PENDING") {
        throw new AppError(409, `This request was already ${before.status.toLowerCase()}.`);
      }
      throw new AppError(403, "You are not the approver for this step.");
    }

    const now = new Date();
    await tx.approvalStep.update({
      where: { id: current.id, ...forTenant(ctx.tenantId) },
      data: {
        status: wanted,
        decidedById: ctx.actorId,
        reason: input.reason ?? null,
        decidedAt: now,
      },
    });

    let final = false;
    let action: string;

    if (wanted === "REJECTED") {
      // A rejection ends the request. Later steps never happen.
      await tx.approvalStep.updateMany({
        where: { requestId: before.id, ...forTenant(ctx.tenantId), status: "WAITING" },
        data: { status: "CANCELLED" },
      });
      await tx.approvalRequest.update({
        where: { id: before.id, ...forTenant(ctx.tenantId) },
        data: { status: "REJECTED", decidedAt: now },
      });
      final = true;
      action = "approval.rejected";
    } else {
      const next = before.steps.find((s) => s.status === "WAITING");
      if (next) {
        await activateStep(tx, ctx.tenantId, before.requesterId, next);
        action = "approval.step_approved";
      } else {
        await tx.approvalRequest.update({
          where: { id: before.id, ...forTenant(ctx.tenantId) },
          data: { status: "APPROVED", decidedAt: now },
        });
        final = true;
        action = "approval.approved";
      }
    }

    const after = await tx.approvalRequest.findFirstOrThrow({
      where: { id: before.id, ...forTenant(ctx.tenantId) },
      include: withSteps,
    });
    await audit.record(tx, {
      tenantId: ctx.tenantId,
      actorId: ctx.actorId,
      action,
      entity: "ApprovalRequest",
      entityId: after.id,
      before,
      after,
    });
    return { request: after, repeated: false, final };
  });

  // Step 5: only after the decision is saved, tell the module that asked.
  if (outcome.final) await publishDecided(outcome.request.id);
  return { request: outcome.request, repeated: outcome.repeated };
}

export async function withdrawRequest(ctx: Ctx, requestId: string) {
  const outcome = await prisma.$transaction(async (tx) => {
    await lockRequest(tx, requestId);

    const before = await tx.approvalRequest.findFirst({
      where: { id: requestId, ...forTenant(ctx.tenantId) },
      include: withSteps,
    });
    if (!before) throw new AppError(404, "Approval request not found.");
    if (before.requesterId !== ctx.actorId) {
      throw new AppError(403, "Only the person who made the request can withdraw it.");
    }
    if (before.status === "WITHDRAWN") return { request: before, repeated: true, final: false };
    if (before.status !== "PENDING") {
      throw new AppError(
        409,
        `This request was already ${before.status.toLowerCase()}, so it can no longer be withdrawn.`,
      );
    }

    await tx.approvalStep.updateMany({
      where: {
        requestId: before.id,
        ...forTenant(ctx.tenantId),
        status: { in: ["WAITING", "PENDING"] },
      },
      data: { status: "CANCELLED" },
    });
    await tx.approvalRequest.update({
      where: { id: before.id, ...forTenant(ctx.tenantId) },
      data: { status: "WITHDRAWN", decidedAt: new Date() },
    });

    const after = await tx.approvalRequest.findFirstOrThrow({
      where: { id: before.id, ...forTenant(ctx.tenantId) },
      include: withSteps,
    });
    await audit.record(tx, {
      tenantId: ctx.tenantId,
      actorId: ctx.actorId,
      action: "approval.withdrawn",
      entity: "ApprovalRequest",
      entityId: after.id,
      before,
      after,
    });
    return { request: after, repeated: false, final: true };
  });

  if (outcome.final) await publishDecided(outcome.request.id);
  return { request: outcome.request, repeated: outcome.repeated };
}

// ======================= Reading =======================

export async function listPending(ctx: Ctx) {
  const steps = await prisma.approvalStep.findMany({
    where: {
      ...forTenant(ctx.tenantId),
      status: "PENDING",
      request: { status: "PENDING", requesterId: { not: ctx.actorId } },
      OR: [
        { assignedUserId: ctx.actorId },
        { assignedUserId: null, approverRole: ctx.role },
      ],
    },
    include: { request: true },
    orderBy: { activatedAt: "asc" },
    take: 100,
  });

  // The User table is global (not tenant-owned), so no tenant filter is needed here.
  const requesterIds = [...new Set(steps.map((s) => s.request.requesterId))];
  const users = await prisma.user.findMany({
    where: { id: { in: requesterIds } },
    select: { id: true, email: true },
  });
  const emailOf = new Map(users.map((u) => [u.id, u.email]));

  return steps.map((s) => ({
    requestId: s.request.id,
    stepId: s.id,
    stepPosition: s.position,
    module: s.request.module,
    type: s.request.type,
    summary: s.request.summary,
    subjectEntity: s.request.subjectEntity,
    subjectId: s.request.subjectId,
    requesterId: s.request.requesterId,
    requesterEmail: emailOf.get(s.request.requesterId) ?? null,
    waitingSince: s.activatedAt,
    escalated: s.escalatedAt !== null,
  }));
}

export async function listMine(ctx: Ctx, query: MyRequestsQuery) {
  return prisma.approvalRequest.findMany({
    where: {
      ...forTenant(ctx.tenantId),
      requesterId: ctx.actorId,
      ...(query.status ? { status: query.status } : {}),
    },
    include: withSteps,
    orderBy: { createdAt: "desc" },
    take: query.limit,
  });
}

export async function getRequest(ctx: Ctx, id: string) {
  const request = await prisma.approvalRequest.findFirst({
    where: { id, ...forTenant(ctx.tenantId) },
    include: withSteps,
  });
  const involved =
    request !== null &&
    (request.requesterId === ctx.actorId ||
      request.steps.some(
        (s) =>
          s.decidedById === ctx.actorId ||
          s.assignedUserId === ctx.actorId ||
          (s.assignedUserId === null && s.approverRole === ctx.role),
      ));
  if (!request || !involved) throw new AppError(404, "Approval request not found.");
  return request;
}

// ======================= Step 5: approval.decided =======================

export async function publishDecided(requestId: string) {
  try {
    const r = await prisma.approvalRequest.findUnique({ where: { id: requestId } });
    if (!r || r.status === "PENDING" || r.eventPublishedAt) return;

    const event: ApprovalDecidedEvent = {
      requestId: r.id,
      tenantId: r.tenantId,
      module: r.module,
      type: r.type,
      subjectEntity: r.subjectEntity,
      subjectId: r.subjectId,
      requesterId: r.requesterId,
      status: r.status,
      decidedAt: (r.decidedAt ?? new Date()).toISOString(),
    };
    await enqueueApprovalDecided(event);
    await prisma.approvalRequest.update({
      where: { id: r.id, ...forTenant(r.tenantId) },
      data: { eventPublishedAt: new Date() },
    });
  } catch (err) {
    // The decision is already saved. The sweep below sends the event again later.
    console.error("Could not publish approval.decided yet:", err);
  }
}

// ======================= Step 4: the sweep (runs every 10 minutes) =======================

// A system job: there is no signed-in user, so this is not written to the audit log.
// What happened is recorded on the step itself (escalatedAt, escalationNote).
async function escalateStep(stepId: string, tenantId: string, note: string) {
  await prisma.$transaction(async (tx) => {
    const found = await tx.approvalStep.findFirst({
      where: { id: stepId, ...forTenant(tenantId) },
      select: { requestId: true },
    });
    if (!found) return;

    await lockRequest(tx, found.requestId);

    const step = await tx.approvalStep.findFirst({
      where: { id: stepId, ...forTenant(tenantId) },
      include: { request: true },
    });
    // Someone may have decided in the meantime.
    if (!step || step.status !== "PENDING" || step.escalatedAt || step.request.status !== "PENDING") {
      return;
    }

    const fallback = await resolveFallback(tx, tenantId, step.request.requesterId);
    if (!fallback) {
      console.warn(`No fallback approver is available for step ${stepId}.`);
      return;
    }

    await tx.approvalStep.update({
      where: { id: stepId, ...forTenant(tenantId) },
      data: {
        assignedUserId: fallback.assignedUserId,
        approverRole: fallback.approverRole,
        escalatedAt: new Date(),
        escalationNote: note,
      },
    });
  });
}

async function escalateOverdueSteps() {
  // Cross-tenant on purpose: find which tenants have steps waiting, then work tenant by tenant.
  const tenants = await prisma.approvalStep.findMany({
    where: { status: "PENDING", escalatedAt: null },
    distinct: ["tenantId"],
    select: { tenantId: true },
  });

  for (const { tenantId } of tenants) {
    const hours = await getNumberSetting(
      tenantId,
      SETTING_KEYS.approvalFallbackHours,
      DEFAULT_FALLBACK_HOURS,
    );
    const cutoff = new Date(Date.now() - hours * 3_600_000);

    const overdue = await prisma.approvalStep.findMany({
      where: {
        ...forTenant(tenantId),
        status: "PENDING",
        escalatedAt: null,
        activatedAt: { lt: cutoff },
      },
      select: { id: true },
      take: 200,
    });

    for (const step of overdue) {
      try {
        await escalateStep(
          step.id,
          tenantId,
          `No decision within ${hours} hours. Moved to the fallback approver.`,
        );
      } catch (err) {
        console.error(`Could not escalate step ${step.id}:`, err);
      }
    }
  }
}

// An assigned approver who has left the tenant is "unavailable": move on without waiting.
async function escalateUnavailableApprovers() {
  const steps = await prisma.approvalStep.findMany({
    where: { status: "PENDING", escalatedAt: null, assignedUserId: { not: null } },
    select: { id: true, tenantId: true, assignedUserId: true },
    take: 500,
  });

  const byTenant = new Map<string, { id: string; userId: string }[]>();
  for (const s of steps) {
    if (!s.assignedUserId) continue;
    byTenant.set(s.tenantId, [...(byTenant.get(s.tenantId) ?? []), { id: s.id, userId: s.assignedUserId }]);
  }

  for (const [tenantId, items] of byTenant) {
    const members = await prisma.membership.findMany({
      where: { ...forTenant(tenantId), userId: { in: items.map((i) => i.userId) } },
      select: { userId: true },
    });
    const present = new Set(members.map((m) => m.userId));

    for (const item of items) {
      if (present.has(item.userId)) continue;
      try {
        await escalateStep(item.id, tenantId, "The approver is no longer a member. Moved to the fallback approver.");
      } catch (err) {
        console.error(`Could not escalate step ${item.id}:`, err);
      }
    }
  }
}

// If a decision was saved but its event never left (for example the server stopped), send it now.
async function republishMissedEvents() {
  const cutoff = new Date(Date.now() - 2 * 60_000);
  const missed = await prisma.approvalRequest.findMany({
    where: { status: { not: "PENDING" }, eventPublishedAt: null, decidedAt: { lt: cutoff } },
    select: { id: true },
    take: 100,
  });
  for (const m of missed) {
    await publishDecided(m.id);
  }
}

export async function runApprovalSweep() {
  await escalateOverdueSteps();
  await escalateUnavailableApprovers();
  await republishMissedEvents();
}