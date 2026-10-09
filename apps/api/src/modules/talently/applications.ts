import type { QuestionType } from "@prisma/client";
import { z } from "zod";
import { prisma, Prisma } from "../../platform/prisma.js";
import { forTenant } from "../../platform/for-tenant.js";
import { AppError } from "../../platform/errors.js";
import type { ApplyBody } from "./application-schemas.js";
import { enqueueScore } from "../../platform/queue.js";

type CachedQuestion = {
  id: string;
  type: QuestionType;
  text: string;
  required: boolean;
  optionIds: Set<string>;
};

// A published job's template version never changes (AS-110 freezes it), so its questions
// can be cached safely. This saves database round trips on every application.
const questionCache = new Map<string, CachedQuestion[]>();

async function questionsFor(templateId: string): Promise<CachedQuestion[]> {
  const hit = questionCache.get(templateId);
  if (hit) return hit;

  // templateId comes from a PUBLISHED job, so it is a frozen version.
  const rows = await prisma.question.findMany({
    where: { templateId },
    orderBy: { position: "asc" },
    select: { id: true, type: true, text: true, required: true, options: { select: { id: true } } },
  });

  const questions: CachedQuestion[] = rows.map((q) => ({
    id: q.id,
    type: q.type,
    text: q.text,
    required: q.required,
    optionIds: new Set(q.options.map((o) => o.id)),
  }));

  if (questionCache.size >= 500) questionCache.clear();
  questionCache.set(templateId, questions);
  return questions;
}

// The resume key must be one we issued for THIS job: resumes/<jobId>/<uuid>.<ext>
function resumeKeyPattern(jobId: string) {
  return new RegExp(
    `^resumes/${jobId}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\\.(pdf|doc|docx)$`,
  );
}

function valueSchemaFor(q: CachedQuestion, jobId: string): z.ZodType {
  switch (q.type) {
    case "SINGLE_CHOICE":
    case "YES_NO":
      return z.string().refine((v) => q.optionIds.has(v), "Choose one of the listed options.");
    case "MULTIPLE_CHOICE":
      return z
        .array(z.string())
        .min(1, "Choose at least one option.")
        .refine((a) => new Set(a).size === a.length, "Each option can be chosen only once.")
        .refine((a) => a.every((v) => q.optionIds.has(v)), "Choose only from the listed options.");
    case "NUMBER_BANDS":
      return z.number({ message: "Enter a number." }).min(-1e9).max(1e9);
    case "RATING":
      return z
        .number({ message: "Choose a rating from 1 to 5." })
        .int("Choose a rating from 1 to 5.")
        .min(1, "Choose a rating from 1 to 5.")
        .max(5, "Choose a rating from 1 to 5.");
    case "SHORT_TEXT":
      return z.string().trim().min(1, "Enter an answer.").max(2000, "Keep the answer under 2000 characters.");
    case "FILE":
      return z
        .string()
        .regex(resumeKeyPattern(jobId), "Upload your resume first, then send the file key you received.");
  }
}

const isBlank = (v: unknown) =>
  v === undefined || v === null || v === "" || (Array.isArray(v) && v.length === 0);

function validateAnswers(
  questions: CachedQuestion[],
  given: ApplyBody["answers"],
  jobId: string,
): { questionId: string; value: unknown }[] {
  const errors: string[] = [];
  const known = new Set(questions.map((q) => q.id));
  const byId = new Map<string, unknown>();

  for (const a of given) {
    if (!known.has(a.questionId)) {
      errors.push(`Unknown question: ${a.questionId}.`);
    } else if (byId.has(a.questionId)) {
      errors.push(`Question ${a.questionId} was answered more than once.`);
    } else {
      byId.set(a.questionId, a.value);
    }
  }

  const clean: { questionId: string; value: unknown }[] = [];
  for (const q of questions) {
    const value = byId.get(q.id);
    if (isBlank(value)) {
      if (q.required) errors.push(`"${q.text}" is required.`);
      continue;
    }
    const parsed = valueSchemaFor(q, jobId).safeParse(value);
    if (!parsed.success) {
      errors.push(`"${q.text}": ${parsed.error.issues[0]?.message ?? "Invalid answer."}`);
    } else {
      clean.push({ questionId: q.id, value: parsed.data });
    }
  }

  if (errors.length > 0) throw new AppError(400, errors.join("; "));
  return clean;
}

// PUBLIC route: the candidate is not signed in. The job is found by its unguessable UUID
// while PUBLISHED. Everything after that is scoped with forTenant(job.tenantId).
export async function submitApplication(jobId: string, body: ApplyBody) {
  const startedAt = new Date();

  const job = await prisma.job.findFirst({
    where: { id: jobId, status: "PUBLISHED" },
    select: { id: true, tenantId: true, templateId: true },
  });
  if (!job) throw new AppError(404, "This job is not open for applications.");

  const questions = await questionsFor(job.templateId);
  const answers = validateAnswers(questions, body.answers, job.id);

  const fileQuestion = questions.find((q) => q.type === "FILE");
  const resumeKey = fileQuestion
    ? ((answers.find((a) => a.questionId === fileQuestion.id)?.value as string | undefined) ?? null)
    : null;

  const answerRows = answers.map((a) => ({
    questionId: a.questionId,
    value: a.value as Prisma.InputJsonValue,
  }));

  // Fields that are set on a new application and refreshed on a repeat one.
  const fields = {
    candidateName: body.name,
    phone: body.phone,
    resumeKey,
    consentAt: new Date(), // server time, UTC: this is the stored consent time
    status: "RECEIVED" as const,
  };

  // Step 4: same email + same job updates the existing application (see the unique
  // key on [jobId, email]). On update the old answers are replaced by the new ones.
  const application = await prisma.application
    .upsert({
      where: { jobId_email: { jobId: job.id, email: body.email } },
      create: {
        ...forTenant(job.tenantId),
        jobId: job.id,
        email: body.email,
        ...fields,
        answers: { createMany: { data: answerRows } },
      },
      update: {
        ...fields,
        answers: { deleteMany: {}, createMany: { data: answerRows } },
      },
      select: { id: true, createdAt: true },
    })
    .catch((e: unknown) => {
      // Two identical submissions at the exact same moment: one of them loses the race.
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        throw new AppError(409, "We are already processing your application. Please wait a moment and try again.");
      }
      throw e;
    });

  // A row created before this request started means we merged into an existing application.
  const merged = application.createdAt < startedAt;

    // Step 5: queue the scoring job, then answer straight away. The candidate never waits for scoring.
  try {
    await enqueueScore(application.id);
  } catch {
    // The application is saved. Submitting again merges into it and queues it again.
    throw new AppError(
      503,
      "Your application was saved, but we could not start processing it. Please submit again in a minute.",
    );
  }

  return { applicationId: application.id, merged, status: "RECEIVED" as const };
}