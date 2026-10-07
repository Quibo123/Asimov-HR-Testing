import { randomUUID } from "node:crypto";
import { prisma, Prisma, type Tx } from "../../platform/prisma.js";
import { forTenant } from "../../platform/for-tenant.js";
import { audit } from "../../platform/audit.js";
import { AppError } from "../../platform/errors.js";
import type { Ctx } from "../../platform/ctx.js";
import type { TemplateBody } from "./schemas.js";

const templateInclude = {
  questions: {
    orderBy: { position: "asc" },
    include: { options: { orderBy: { position: "asc" } } },
  },
} satisfies Prisma.QuestionnaireTemplateInclude;

function questionsCreateData(questions: TemplateBody["questions"]) {
  return questions.map((q, i) => ({
    position: i,
    type: q.type,
    text: q.text,
    weight: q.weight,
    required: q.required,
    mustHave: q.mustHave,
    options: {
      create: q.options.map((o, j) => ({
        position: j,
        label: o.label,
        scorePercent: o.scorePercent,
        minValue: o.minValue ?? null,
        maxValue: o.maxValue ?? null,
      })),
    },
  }));
}

// Row lock so "edit template" and "publish job" can never run at the same moment.
async function lockTemplate(tx: Tx, id: string) {
  await tx.$queryRaw`SELECT id FROM talently."QuestionnaireTemplate" WHERE id = ${id} FOR UPDATE`;
}

function rethrowConflict(e: unknown): never {
  if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
    throw new AppError(409, "This template was edited at the same time. Reload it and try again.");
  }
  throw e;
}

// ======================= Templates =======================

export async function listTemplates(tenantId: string) {
  return prisma.questionnaireTemplate.findMany({
    where: { ...forTenant(tenantId) },
    select: { id: true, groupId: true, name: true, version: true, createdAt: true },
    orderBy: [{ createdAt: "desc" }],
  });
}

export async function getTemplate(tenantId: string, id: string) {
  const template = await prisma.questionnaireTemplate.findFirst({
    where: { id, ...forTenant(tenantId) },
    include: templateInclude,
  });
  if (!template) throw new AppError(404, "Template not found.");
  return template;
}

export async function createTemplate(ctx: Ctx, body: TemplateBody) {
  return prisma.$transaction(async (tx) => {
    const created = await tx.questionnaireTemplate.create({
      data: {
        ...forTenant(ctx.tenantId),
        groupId: randomUUID(),
        name: body.name,
        version: 1,
        questions: { create: questionsCreateData(body.questions) },
      },
      include: templateInclude,
    });

    await audit.record(tx, {
      tenantId: ctx.tenantId,
      actorId: ctx.actorId,
      action: "template.created",
      entity: "QuestionnaireTemplate",
      entityId: created.id,
      after: created,
    });
    return created;
  });
}

// Edit rule: if any live (non-draft) job uses this template version, it is frozen,
// so an edit creates a NEW version. Otherwise it is edited in place.
export async function updateTemplate(ctx: Ctx, id: string, body: TemplateBody) {
  try {
    return await prisma.$transaction(async (tx) => {
      await lockTemplate(tx, id);

      const before = await tx.questionnaireTemplate.findFirst({
        where: { id, ...forTenant(ctx.tenantId) },
        include: templateInclude,
      });
      if (!before) throw new AppError(404, "Template not found.");

      const liveJobs = await tx.job.count({
        where: { ...forTenant(ctx.tenantId), templateId: id, templateVersion: { not: null } },
      });

      if (liveJobs === 0) {
        // Safe: the template was already verified to belong to this tenant above.
        await tx.question.deleteMany({ where: { templateId: id } });
        const after = await tx.questionnaireTemplate.update({
          where: { id, ...forTenant(ctx.tenantId) },
          data: { name: body.name, questions: { create: questionsCreateData(body.questions) } },
          include: templateInclude,
        });
        await audit.record(tx, {
          tenantId: ctx.tenantId,
          actorId: ctx.actorId,
          action: "template.updated",
          entity: "QuestionnaireTemplate",
          entityId: after.id,
          before,
          after,
        });
        return { template: after, newVersion: false };
      }

      const latest = await tx.questionnaireTemplate.aggregate({
        where: { groupId: before.groupId, ...forTenant(ctx.tenantId) },
        _max: { version: true },
      });
      const created = await tx.questionnaireTemplate.create({
        data: {
          ...forTenant(ctx.tenantId),
          groupId: before.groupId,
          name: body.name,
          version: (latest._max.version ?? before.version) + 1,
          questions: { create: questionsCreateData(body.questions) },
        },
        include: templateInclude,
      });
      await audit.record(tx, {
        tenantId: ctx.tenantId,
        actorId: ctx.actorId,
        action: "template.versioned",
        entity: "QuestionnaireTemplate",
        entityId: created.id,
        before,
        after: created,
      });
      return { template: created, newVersion: true };
    });
  } catch (e) {
    rethrowConflict(e);
  }
}

export async function copyTemplate(ctx: Ctx, id: string, name?: string) {
  return prisma.$transaction(async (tx) => {
    const source = await tx.questionnaireTemplate.findFirst({
      where: { id, ...forTenant(ctx.tenantId) },
      include: templateInclude,
    });
    if (!source) throw new AppError(404, "Template not found.");

    const copy = await tx.questionnaireTemplate.create({
      data: {
        ...forTenant(ctx.tenantId),
        groupId: randomUUID(), // a copy starts its own template, at version 1
        name: name ?? `${source.name} (copy)`,
        version: 1,
        questions: {
          create: source.questions.map((q) => ({
            position: q.position,
            type: q.type,
            text: q.text,
            weight: q.weight,
            required: q.required,
            mustHave: q.mustHave,
            options: {
              create: q.options.map((o) => ({
                position: o.position,
                label: o.label,
                scorePercent: o.scorePercent,
                minValue: o.minValue,
                maxValue: o.maxValue,
              })),
            },
          })),
        },
      },
      include: templateInclude,
    });

    await audit.record(tx, {
      tenantId: ctx.tenantId,
      actorId: ctx.actorId,
      action: "template.copied",
      entity: "QuestionnaireTemplate",
      entityId: copy.id,
      before: { copiedFromId: source.id },
      after: copy,
    });
    return copy;
  });
}

// ======================= Jobs =======================

export async function listJobs(tenantId: string) {
  return prisma.job.findMany({
    where: { ...forTenant(tenantId) },
    orderBy: { createdAt: "desc" },
  });
}

export async function getJob(tenantId: string, id: string) {
  const job = await prisma.job.findFirst({
    where: { id, ...forTenant(tenantId) },
    include: { template: { select: { id: true, name: true, version: true } } },
  });
  if (!job) throw new AppError(404, "Job not found.");
  return job;
}

export async function createJob(
  ctx: Ctx,
  body: { title: string; location: string; templateId: string },
) {
  return prisma.$transaction(async (tx) => {
    const template = await tx.questionnaireTemplate.findFirst({
      where: { id: body.templateId, ...forTenant(ctx.tenantId) },
      select: { id: true },
    });
    if (!template) throw new AppError(404, "Template not found.");

    const job = await tx.job.create({
      data: {
        ...forTenant(ctx.tenantId),
        title: body.title,
        location: body.location,
        templateId: template.id,
        status: "DRAFT",
      },
    });
    await audit.record(tx, {
      tenantId: ctx.tenantId,
      actorId: ctx.actorId,
      action: "job.created",
      entity: "Job",
      entityId: job.id,
      after: job,
    });
    return job;
  });
}

// Step 5: publishing stores the template version on the job and freezes it.
export async function publishJob(ctx: Ctx, id: string) {
  return prisma.$transaction(async (tx) => {
    const before = await tx.job.findFirst({ where: { id, ...forTenant(ctx.tenantId) } });
    if (!before) throw new AppError(404, "Job not found.");
    if (before.status !== "DRAFT") {
      throw new AppError(409, `Only draft jobs can be published (this job is ${before.status}).`);
    }

    await lockTemplate(tx, before.templateId); // waits if someone is editing this template
    const template = await tx.questionnaireTemplate.findFirst({
      where: { id: before.templateId, ...forTenant(ctx.tenantId) },
      select: { version: true },
    });
    if (!template) throw new AppError(404, "Template not found.");

    // Atomic: only succeeds if the job is still a draft.
    const res = await tx.job.updateMany({
      where: { id: before.id, ...forTenant(ctx.tenantId), status: "DRAFT" },
      data: { status: "PUBLISHED", templateVersion: template.version, publishedAt: new Date() },
    });
    if (res.count === 0) throw new AppError(409, "Only draft jobs can be published.");

    const after = await tx.job.findFirstOrThrow({
      where: { id: before.id, ...forTenant(ctx.tenantId) },
    });
    await audit.record(tx, {
      tenantId: ctx.tenantId,
      actorId: ctx.actorId,
      action: "job.published",
      entity: "Job",
      entityId: after.id,
      before,
      after,
    });
    return after;
  });
}

export async function closeJob(ctx: Ctx, id: string) {
  return prisma.$transaction(async (tx) => {
    const before = await tx.job.findFirst({ where: { id, ...forTenant(ctx.tenantId) } });
    if (!before) throw new AppError(404, "Job not found.");
    if (before.status !== "PUBLISHED") {
      throw new AppError(409, `Only published jobs can be closed (this job is ${before.status}).`);
    }

    const res = await tx.job.updateMany({
      where: { id: before.id, ...forTenant(ctx.tenantId), status: "PUBLISHED" },
      data: { status: "CLOSED", closedAt: new Date() },
    });
    if (res.count === 0) throw new AppError(409, "Only published jobs can be closed.");

    const after = await tx.job.findFirstOrThrow({
      where: { id: before.id, ...forTenant(ctx.tenantId) },
    });
    await audit.record(tx, {
      tenantId: ctx.tenantId,
      actorId: ctx.actorId,
      action: "job.closed",
      entity: "Job",
      entityId: after.id,
      before,
      after,
    });
    return after;
  });
}

// ======================= Public portal (Step 6) =======================

// PUBLIC lookup: this request has no tenant (the visitor is not signed in), so
// forTenant() cannot be used. It is safe because a job is found only by its unguessable
// UUID and only while PUBLISHED.
// NEVER add weight, scorePercent or mustHave to this response. Candidates must not see how they are scored.
export async function getPublicJob(id: string) {
  const job = await prisma.job.findFirst({
    where: { id, status: "PUBLISHED" },
    select: {
      id: true,
      title: true,
      location: true,
      publishedAt: true,
      template: {
        select: {
          questions: {
            orderBy: { position: "asc" },
            select: {
              id: true,
              type: true,
              text: true,
              required: true,
              options: { orderBy: { position: "asc" }, select: { id: true, label: true } },
            },
          },
        },
      },
    },
  });
  if (!job) throw new AppError(404, "Job not found.");

  return {
    id: job.id,
    title: job.title,
    location: job.location,
    publishedAt: job.publishedAt,
    questions: job.template.questions.map((q) => {
      const showOptions =
        q.type === "SINGLE_CHOICE" || q.type === "MULTIPLE_CHOICE" || q.type === "YES_NO";
      return {
        id: q.id,
        type: q.type,
        text: q.text,
        required: q.required,
        // Options are shown for choice questions only. Number bands and rating options
        // would reveal how answers are scored, so those are not sent.
        ...(showOptions ? { options: q.options } : {}),
        ...(q.type === "RATING" ? { scale: { min: 1, max: 5 } } : {}),
      };
    }),
  };
}