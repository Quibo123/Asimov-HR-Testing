import { prisma, Prisma } from "../../../platform/prisma.js";
import { forTenant } from "../../../platform/for-tenant.js";
import { getBooleanSetting, SETTING_KEYS } from "../../../platform/settings.js";
import { chooseScorers } from "./scorers.js";
import type { ScoreResult } from "./Scorer.js";

// Runs in the background (pg-boss). There is no signed-in user here, so the application row
// itself tells us which tenant it belongs to, and every later query uses forTenant().
export async function runScoring(applicationId: string) {
  const application = await prisma.application.findUnique({
    where: { id: applicationId },
    include: {
      answers: true,
      job: { select: { templateId: true, scoringMethod: true } },
    },
  });
  if (!application) return; // deleted after it was queued: nothing to do

  const tenantId = application.tenantId;

  // The job's template version is frozen once the job is published (AS-110).
  const template = await prisma.questionnaireTemplate.findFirst({
    where: { id: application.job.templateId, ...forTenant(tenantId) },
    include: {
      questions: {
        orderBy: { position: "asc" },
        include: { options: { orderBy: { position: "asc" } } },
      },
    },
  });
  if (!template) throw new Error(`Template ${application.job.templateId} not found.`);

  // The AI scorer can only run when the tenant has switched AI scoring on.
  const aiEnabled = await getBooleanSetting(tenantId, SETTING_KEYS.aiEnabled, false);
  const scorers = chooseScorers(application.job.scoringMethod, aiEnabled);

  const scoringApplication = {
    id: application.id,
    answers: application.answers.map((a) => ({ questionId: a.questionId, value: a.value })),
  };
  const templateVersion = { version: template.version, questions: template.questions };

  // Score first (a future AI scorer may be slow), then save everything in one short transaction.
  const results: { scorer: "form" | "ai"; result: ScoreResult }[] = [];
  for (const scorer of scorers) {
    results.push({ scorer: scorer.name, result: await scorer.score(scoringApplication, templateVersion) });
  }

  await prisma.$transaction(async (tx) => {
    for (const { scorer, result } of results) {
      const data = {
        templateVersion: template.version,
        total: result.total,
        breakdown: result.breakdown as unknown as Prisma.InputJsonValue,
        mustHavesFailed: result.mustHavesFailed as unknown as Prisma.InputJsonValue,
      };
      await tx.score.upsert({
        where: { applicationId_scorer: { applicationId, scorer } },
        create: { ...forTenant(tenantId), applicationId, scorer, ...data },
        update: data, // scoring again (a merged application) replaces the old score
      });
    }

    // "Scored, awaiting HR verification". Nothing here ever rejects a candidate.
    await tx.application.update({
      where: { id: applicationId, ...forTenant(tenantId) },
      data: { status: "SCORED" },
    });
  });
}