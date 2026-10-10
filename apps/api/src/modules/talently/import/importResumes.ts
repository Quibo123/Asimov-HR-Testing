import { randomUUID } from "node:crypto";
import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { prisma, Prisma } from "../../../platform/prisma.js";
import { forTenant } from "../../../platform/for-tenant.js";
import { deleteObject, uploadObject } from "../../../platform/r2Upload.js";
import { getBrand } from "../../../platform/notifications/brand.js";
import { renderEmail, type Brand } from "../../../platform/notifications/emailTemplate.js";
import { assertSafeText, cleanText } from "../../../platform/notifications/guard.js";
import { sendEmail } from "../../../platform/notifications/resend.js";
import {
  MAX_IMPORT_BYTES,
  findResumeFile,
  looksLikePdf,
  parseResumeCsv,
  pickJob,
  rowSchema,
  type CsvRow,
  type JobRef,
} from "./helpers.js";

export type ImportOptions = {
  tenantId: string;
  csvPath: string;
  folder: string;
  invite: boolean; // email each candidate a link to the questionnaire
  dryRun: boolean; // check everything, change nothing
};

export type Failure = {
  row: number;
  email: string;
  stage: "validate" | "job" | "file" | "upload" | "save" | "invite" | "unexpected";
  reason: string;
};

export type ImportReport = {
  tenantId: string;
  invite: boolean;
  dryRun: boolean;
  startedAt: string;
  finishedAt: string;
  rows: number;
  imported: number; // with --dry-run: "would import"
  skippedDuplicate: number;
  invited: number;
  failures: Failure[];
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const describe = (err: unknown) => (err instanceof Error ? err.message : String(err)).replace(/\s+/g, " ").slice(0, 300);
const isUniqueViolation = (err: unknown) =>
  err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";

// Try an email up to 3 times (waits 2 s, then 4 s).
async function withRetry<T>(action: () => Promise<T>): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      return await action();
    } catch (err) {
      lastError = err;
      if (attempt < 3) await sleep(2000 * attempt);
    }
  }
  throw lastError;
}

async function sendInvite(input: {
  brand: Brand;
  applicationId: string;
  jobId: string;
  jobTitle: string;
  name: string;
  email: string;
}) {
  const baseUrl = process.env.APP_BASE_URL ?? "http://localhost:5173";
  const url = new URL(`/portal/jobs/${input.jobId}`, baseUrl).toString();
  const firstName = cleanText(input.name.split(" ")[0] ?? input.name, 60);
  const jobTitle = cleanText(input.jobTitle, 100);

  const title = `Complete your application: ${jobTitle}`;
  const body =
    `Hi ${firstName}, we have your resume on file for the ${jobTitle} role at ${input.brand.tenantName}. ` +
    `Please complete a short questionnaire so we can consider your application. ` +
    `Use this email address (${input.email}) when you fill it in.`;

  // The same guard as every notification: nothing about salary, bank or ID details.
  assertSafeText(title);
  assertSafeText(body);

  const email = renderEmail({
    brand: input.brand,
    title,
    body,
    url,
    buttonLabel: "Complete the questionnaire",
    footer: `You are receiving this because ${input.brand.tenantName} has your resume on file. If this is not you, you can ignore this email.`,
  });

  await withRetry(() =>
    sendEmail({
      fromName: input.brand.senderName,
      to: input.email,
      subject: email.subject,
      html: email.html,
      text: email.text,
      idempotencyKey: `invite-${input.applicationId}`, // Resend ignores a repeated send of the same invite
    }),
  );
}

export async function runImport(opts: ImportOptions): Promise<ImportReport> {
  const startedAt = new Date().toISOString();

  // Nothing below changes anything until the CSV, the folder and the jobs have been read.
  const rows = parseResumeCsv(await readFile(opts.csvPath, "utf8"));
  const pdfFiles = (await readdir(opts.folder)).filter((f) => f.toLowerCase().endsWith(".pdf"));
  const jobs: JobRef[] = await prisma.job.findMany({
    where: { ...forTenant(opts.tenantId) },
    select: { id: true, title: true, status: true },
  });
  const brand = opts.invite ? await getBrand(opts.tenantId) : null;

  const failures: Failure[] = [];
  let imported = 0;
  let skippedDuplicate = 0;
  let invited = 0;
  const seenInThisRun = new Set<string>(); // lets a dry run notice duplicates inside the CSV

  const fail = (row: CsvRow, stage: Failure["stage"], reason: string) => {
    failures.push({ row: row.rowNumber, email: row.email || "(no email)", stage, reason });
  };

  // Step 3: the optional invite. Never runs without --invite, and never in a dry run.
  async function invite(row: CsvRow, applicationId: string, job: JobRef, name: string, email: string) {
    if (!opts.invite || opts.dryRun || !brand) return;

    if (job.status !== "PUBLISHED") {
      fail(row, "invite", `The job "${job.title}" is not published yet, so no invite was sent.`);
      return;
    }
    try {
      await sendInvite({ brand, applicationId, jobId: job.id, jobTitle: job.title, name, email });
      await prisma.application.update({
        where: { id: applicationId, ...forTenant(opts.tenantId) },
        data: { invitedAt: new Date() },
      });
      invited++;
      await sleep(600); // Resend allows about 2 emails per second
    } catch (err) {
      fail(row, "invite", `Invite email failed: ${describe(err)}`);
    }
  }

  async function processRow(row: CsvRow) {
    const parsed = rowSchema.safeParse(row);
    if (!parsed.success) {
      fail(row, "validate", parsed.error.issues.map((i) => i.message).join(" "));
      return;
    }
    const data = parsed.data;

    const picked = pickJob(jobs, data.job);
    if ("error" in picked) {
      fail(row, "job", picked.error);
      return;
    }
    const job = picked.job;

    // Step 2: the same email on the same job is skipped. Checked BEFORE any upload.
    const duplicateKey = `${job.id}|${data.email}`;
    const existing = await prisma.application.findFirst({
      where: { ...forTenant(opts.tenantId), jobId: job.id, email: data.email },
      select: { id: true, source: true, status: true, invitedAt: true },
    });
    if (existing || (opts.dryRun && seenInThisRun.has(duplicateKey))) {
      skippedDuplicate++;
      // With --invite, someone imported earlier who was never invited can still get the invite now.
      if (existing && existing.source === "import" && existing.status === "IMPORTED" && !existing.invitedAt) {
        await invite(row, existing.id, job, data.name, data.email);
      }
      return;
    }

    const found = findResumeFile(pdfFiles, { name: data.name, email: data.email, file: data.file });
    if ("error" in found) {
      fail(row, "file", found.error);
      return;
    }

    const filePath = path.join(opts.folder, found.file);
    let bytes: Buffer;
    try {
      const info = await stat(filePath);
      if (info.size === 0) {
        fail(row, "file", `"${found.file}" is empty.`);
        return;
      }
      if (info.size > MAX_IMPORT_BYTES) {
        fail(row, "file", `"${found.file}" is larger than 10 MB.`);
        return;
      }
      bytes = await readFile(filePath);
    } catch (err) {
      fail(row, "file", `Could not read "${found.file}": ${describe(err)}`);
      return;
    }
    if (!looksLikePdf(bytes)) {
      fail(row, "file", `"${found.file}" is not a valid PDF file.`);
      return;
    }

    if (opts.dryRun) {
      seenInThisRun.add(duplicateKey);
      imported++; // "would import"
      return;
    }

    // Step 1: upload the PDF to R2 (same key pattern the portal uses).
    const key = `resumes/${job.id}/${randomUUID()}.pdf`;
    try {
      await uploadObject({ key, body: bytes, contentType: "application/pdf" });
    } catch (err) {
      fail(row, "upload", `Upload to R2 failed: ${describe(err)}`);
      return;
    }

    // Step 2: create the application as "Imported, awaiting HR review" with source "import".
    let applicationId: string;
    try {
      const created = await prisma.application.create({
        data: {
          ...forTenant(opts.tenantId),
          jobId: job.id,
          candidateName: data.name,
          email: data.email,
          phone: data.phone,
          resumeKey: key,
          consentAt: null, // no portal consent yet: it is recorded when they complete the questionnaire
          status: "IMPORTED",
          source: "import",
          importedAt: new Date(),
        },
        select: { id: true },
      });
      applicationId = created.id;
    } catch (err) {
      await deleteObject(key).catch(() => undefined); // do not leave an unused file in R2
      if (isUniqueViolation(err)) {
        skippedDuplicate++; // someone else created it a moment ago
        return;
      }
      fail(row, "save", `Could not save the application: ${describe(err)}`);
      return;
    }

    imported++;
    await invite(row, applicationId, job, data.name, data.email);
  }

  for (const row of rows) {
    try {
      await processRow(row);
    } catch (err) {
      // Whatever goes wrong, the row is listed in the report and the run continues.
      fail(row, "unexpected", describe(err));
    }
  }

  return {
    tenantId: opts.tenantId,
    invite: opts.invite,
    dryRun: opts.dryRun,
    startedAt,
    finishedAt: new Date().toISOString(),
    rows: rows.length,
    imported,
    skippedDuplicate,
    invited,
    failures,
  };
}

// Step 4: the report that is printed at the end.
export function formatReport(r: ImportReport): string {
  const line = (label: string, value: number) => `  ${label.padEnd(28)}${value}`;
  const lines = [
    "",
    r.dryRun ? "Import report (DRY RUN: nothing was written, uploaded or sent)" : "Import report",
    line("Rows in the CSV", r.rows),
    line(r.dryRun ? "Would import" : "Imported", r.imported),
    line("Skipped (duplicate)", r.skippedDuplicate),
    line("Failed (listed below)", r.failures.length),
    line("Invites sent", r.invited),
  ];

  // Step 5: be explicit that nothing was emailed without --invite.
  if (!r.invite) lines.push("  No emails were sent (--invite was not used).");

  if (r.failures.length > 0) {
    lines.push("", "Failures:");
    for (const f of r.failures) {
      lines.push(`  row ${String(f.row).padEnd(4)} ${f.email}  [${f.stage}]  ${f.reason}`);
    }
  }
  return lines.join("\n");
}