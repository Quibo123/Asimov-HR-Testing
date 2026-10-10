import "dotenv/config";
import { existsSync, statSync, writeFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { prisma } from "../src/platform/prisma.js";
import { assertR2Configured } from "../src/platform/r2Upload.js";
import { formatReport, runImport } from "../src/modules/talently/import/importResumes.js";

const USAGE = `Usage:
  npx tsx scripts/import-resumes.ts --tenant <tenant-id> --csv <file.csv> --folder <pdf-folder> [--invite] [--dry-run]

  --dry-run   check everything but write, upload and send nothing
  --invite    also email each candidate a link to complete the questionnaire (no emails without it)`;

async function main() {
  const { values } = parseArgs({
    options: {
      tenant: { type: "string" },
      csv: { type: "string" },
      folder: { type: "string" },
      invite: { type: "boolean", default: false },
      "dry-run": { type: "boolean", default: false },
    },
    strict: true,
  });

  const tenantId = values.tenant;
  const csvPath = values.csv;
  const folder = values.folder;
  const invite = values.invite === true;
  const dryRun = values["dry-run"] === true;

  if (!tenantId || !csvPath || !folder) throw new Error(`Missing options.\n\n${USAGE}`);
  if (!existsSync(csvPath)) throw new Error(`The CSV file was not found: ${csvPath}`);
  if (!existsSync(folder) || !statSync(folder).isDirectory()) {
    throw new Error(`The PDF folder was not found: ${folder}`);
  }

  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { name: true } });
  if (!tenant) throw new Error(`No tenant with id ${tenantId}.`);

  // Fail before touching anything if something needed is not set up.
  if (!dryRun) assertR2Configured();
  if (invite && !dryRun) {
    const missing = ["RESEND_API_KEY", "RESEND_FROM_ADDRESS", "APP_BASE_URL"].filter((k) => !process.env[k]);
    if (missing.length > 0) throw new Error(`--invite needs these values in .env: ${missing.join(", ")}`);
  }

  console.log(
    `Importing into "${tenant.name}"${dryRun ? " (dry run)" : ""}${invite ? " with invites" : " without emails"}...`,
  );

  const report = await runImport({ tenantId, csvPath, folder, invite, dryRun });
  console.log(formatReport(report));

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const reportFile = `import-report-${stamp}.json`;
  writeFileSync(reportFile, JSON.stringify(report, null, 2));
  console.log(`\nFull report saved to ${reportFile} (it contains email addresses, do not commit it).`);

  process.exitCode = report.failures.length > 0 ? 1 : 0; // a non-zero exit code means "look at the failures"
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());