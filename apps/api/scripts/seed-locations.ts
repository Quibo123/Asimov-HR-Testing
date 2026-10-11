import "dotenv/config";
import { parseArgs } from "node:util";
import { prisma } from "../src/platform/prisma.js";
import { forTenant } from "../src/platform/for-tenant.js";
import { isValidTimeZone } from "../src/platform/timeZones.js";

// Weekend days: 1 = Monday ... 7 = Sunday. These are my guesses: confirm them with HR.
const LOCATIONS = [
  { name: "Tiruppur", country: "IN", timeZone: "Asia/Kolkata", weekendDays: [7] },
  { name: "Chennai", country: "IN", timeZone: "Asia/Kolkata", weekendDays: [7] },
  { name: "Dubai", country: "AE", timeZone: "Asia/Dubai", weekendDays: [6, 7] },
];

const USAGE = `Usage:
  npx tsx scripts/seed-locations.ts --tenant <tenant-id>
  npx tsx scripts/seed-locations.ts --tenant-name Bluepeak`;

async function main() {
  const { values } = parseArgs({
    options: { tenant: { type: "string" }, "tenant-name": { type: "string" } },
    strict: true,
  });

  if (!values.tenant && !values["tenant-name"]) throw new Error(`Missing options.\n\n${USAGE}`);

  const tenants = await prisma.tenant.findMany({
    where: values.tenant
      ? { id: values.tenant }
      : { name: { equals: values["tenant-name"], mode: "insensitive" } },
    select: { id: true, name: true },
  });
  if (tenants.length === 0) throw new Error("No matching tenant was found.");
  if (tenants.length > 1) throw new Error("More than one tenant has that name. Use --tenant <id>.");
  const tenant = tenants[0];

  for (const location of LOCATIONS) {
    if (!isValidTimeZone(location.timeZone)) throw new Error(`"${location.timeZone}" is not a valid time zone.`);
  }

  console.log(`Seeding locations for "${tenant.name}" (${tenant.id})`);
  let created = 0;
  for (const location of LOCATIONS) {
    const existing = await prisma.location.findFirst({
      where: { ...forTenant(tenant.id), name: { equals: location.name, mode: "insensitive" } },
      select: { id: true },
    });
    if (existing) {
      console.log(`  ${location.name.padEnd(10)} already exists, left as it is`);
      continue;
    }
    await prisma.location.create({ data: { ...forTenant(tenant.id), ...location } });
    created++;
    console.log(`  ${location.name.padEnd(10)} created (${location.timeZone}, weekend ${location.weekendDays.join(",")})`);
  }
  console.log(`Done: ${created} created, ${LOCATIONS.length - created} already there.`);
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());