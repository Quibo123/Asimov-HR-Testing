import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { balanced, lineOf, walk } from "./lib/scan.js";

const API_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// Tables that belong to a tenant are found by reading the schema (any model with a tenantId field),
// so new tables are covered automatically.
const schema = readFileSync(path.join(API_ROOT, "prisma", "schema.prisma"), "utf8");
const tenantModels = new Set<string>();
for (const m of schema.matchAll(/^model\s+(\w+)\s*\{([\s\S]*?)^\}/gm)) {
  if (/^\s+tenantId\s+String/m.test(m[2])) tenantModels.add(m[1][0].toLowerCase() + m[1].slice(1));
}

// These tables have no tenantId of their own: they belong to a parent that must be checked first.
const CHILD_MODELS = new Set(["question", "option", "answer"]);

// Deliberate exceptions. Every entry needs a reason. Anything not listed here is reported.
type Allowed = { file: string; call: string; contains: string; reason: string };
const ALLOWED: Allowed[] = [
  { file: "modules/talently/service.ts", call: "job.findFirst", contains: 'status: "PUBLISHED" }', reason: "public portal lookup by unguessable job id, PUBLISHED only" },
  { file: "modules/talently/uploads.ts", call: "job.findFirst", contains: 'status: "PUBLISHED" }', reason: "public portal lookup by unguessable job id, PUBLISHED only" },
  { file: "modules/talently/applications.ts", call: "job.findFirst", contains: 'status: "PUBLISHED" }', reason: "public portal lookup by job id; everything after it uses forTenant(job.tenantId)" },
  { file: "modules/talently/scoring/runScoring.ts", call: "application.findUnique", contains: "where: { id: applicationId }", reason: "background job: the application row tells which tenant it belongs to" },
  { file: "platform/auth.ts", call: "membership.findMany", contains: "userId: data.user.id", reason: "finds which tenants the signed-in user belongs to" },
  { file: "platform/approvals/service.ts", call: "approvalStep.findMany", contains: "distinct:", reason: "sweep: finds which tenants have waiting steps" },
  { file: "platform/approvals/service.ts", call: "approvalStep.findMany", contains: "assignedUserId: { not: null }", reason: "sweep across tenants (system job)" },
  { file: "platform/approvals/service.ts", call: "approvalRequest.findMany", contains: "eventPublishedAt: null", reason: "sweep across tenants (system job)" },
  { file: "platform/approvals/service.ts", call: "approvalRequest.findUnique", contains: "where: { id: requestId }", reason: "system job publishing a saved decision" },
  { file: "platform/notifications/service.ts", call: "notification.findUnique", contains: "where: { id: notificationId }", reason: "email worker: the row tells which tenant it belongs to" },
  { file: "platform/notifications/service.ts", call: "notification.findMany", contains: 'emailStatus: "PENDING"', reason: "sweep across tenants (system job)" },
];

const CALL = /\b(prisma|tx|db)\.(\w+)\.(findFirst|findFirstOrThrow|findUnique|findUniqueOrThrow|findMany|count|aggregate|groupBy|create|createMany|update|updateMany|upsert|delete|deleteMany)\s*\(/g;
const RAW = /\$(queryRaw|executeRaw|queryRawUnsafe|executeRawUnsafe)/g;

// "const where = { ..., ...forTenant(x) }" and "const mine = {...}" count as filters when they are used.
function scopedVariables(source: string): string[] {
  const names: string[] = [];
  for (const m of source.matchAll(/\bconst\s+(\w+)\s*=\s*\{/g)) {
    const open = (m.index ?? 0) + m[0].length - 1;
    if (balanced(source, open).includes("forTenant(")) names.push(m[1]);
  }
  return names;
}

const usesScopedVariable = (args: string, names: string[]) =>
  names.some((name) =>
    name === "where"
      ? /\bwhere\s*[,}]/.test(args)
      : new RegExp(`(\\.\\.\\.|where:\\s*)${name}\\b`).test(args),
  );

// tenantId set explicitly (for example "tenantId: input.tenantId"). "tenantId: true" (a select) does not count.
const setsTenantId = (args: string) => /\btenantId\s*(?:,|\}|:\s*(?!true\b))/.test(args);

const files = [
  ...walk(path.join(API_ROOT, "src")),
  ...walk(path.join(API_ROOT, "scripts")),
].filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts"));

let checked = 0;
const flagged: string[] = [];
const allowed: string[] = [];
const children: string[] = [];
const raw: string[] = [];

for (const file of files) {
  const source = readFileSync(file, "utf8");
  const rel = path.relative(API_ROOT, file).replaceAll("\\", "/");
  const scoped = scopedVariables(source);

  for (const m of source.matchAll(CALL)) {
    const model = m[2];
    const op = m[3];
    const at = `${rel}:${lineOf(source, m.index ?? 0)}  ${model}.${op}`;
    const args = balanced(source, (m.index ?? 0) + m[0].length - 1).replace(/\s+/g, " ");

    if (CHILD_MODELS.has(model)) {
      children.push(at);
      continue;
    }
    if (!tenantModels.has(model)) continue; // not a tenant table (for example user, tenant)
    checked++;

    if (args.includes("forTenant(") || setsTenantId(args) || usesScopedVariable(args, scoped)) continue;

    const rule = ALLOWED.find((a) => rel.endsWith(a.file) && a.call === `${model}.${op}` && args.includes(a.contains));
    if (rule) allowed.push(`${at}  (${rule.reason})`);
    else flagged.push(at);
  }

  for (const r of source.matchAll(RAW)) raw.push(`${rel}:${lineOf(source, r.index ?? 0)}  $${r[1]}`);
}

console.log(`Tenant tables found in the schema: ${[...tenantModels].sort().join(", ")}\n`);
console.log(`${checked} calls on tenant tables checked.`);

console.log(`\nAllowed exceptions (${allowed.length}), each with a reason:`);
for (const a of allowed) console.log(`  ${a}`);

console.log(`\nReview by hand: calls on child tables (check the parent was tenant-checked first) (${children.length}):`);
for (const c of children) console.log(`  ${c}`);

console.log(`\nReview by hand: raw SQL (${raw.length}):`);
for (const r of raw) console.log(`  ${r}`);

if (flagged.length > 0) {
  console.log(`\nFLAGGED: ${flagged.length} call(s) without the tenant filter:`);
  for (const f of flagged) console.log(`  ${f}`);
  console.log("\nFix each one with ...forTenant(tenantId). If one is really meant to cross tenants, add it to ALLOWED with a reason.");
  process.exitCode = 1;
} else {
  console.log("\nOK: every call on a tenant table uses the tenant filter, or is an allowed exception.");
}