/**
 * S-105 seed script.
 *
* Creates the two required test tenants in a LOCAL/TEST PostgreSQL database,
 * using the application's own Prisma schema and Prisma Client.
 *
 * The "one user per role" half of S-105 is NOT implemented: the application
 * defines no User model and no Role enum, so there is no row to insert into
 * and no role list to iterate. Rather than invent structure, this script
 * detects what the schema actually offers and reports the blocker.
 *
 * Design constraints (company rules):
 *  - Idempotent: re-running updates the seeded rows instead of duplicating them.
 *  - Non-destructive: only touches rows carrying the deterministic QA ids.
 *    Never truncates, never drops, never deletes unrelated data.
 *  - Safe: refuses to run unless the target database is a local/test instance.
 *  - Honest: reports which parts of the S-105 requirement are not yet
 *    implementable because the application schema does not support them.
 *
 * Usage:
 *   npm run seed            # create/refresh tenants
 *   npm run seed:dry-run    # report what would change, touch nothing
 *   npm run seed -- --verify  # fail if the seeded data is missing
 */
import 'dotenv/config'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { databaseUrl, prismaSchemaPath, maskConnectionString } from '../support/env.ts'
import { SEED_TENANTS } from './tenants.ts'

const args = new Set(process.argv.slice(2))
const DRY_RUN = args.has('--dry-run')
const VERIFY = args.has('--verify')

type SeedResult = {
  created: string[]
  updated: string[]
  unchanged: string[]
  skipped: string[]
}

/** Local/test hosts a seed is allowed to touch. Production is never in this list. */
const ALLOWED_DB_HOSTS = ['localhost', '127.0.0.1', '::1', 'host.docker.internal', 'postgres', 'db']

function assertSafeDatabase(): URL {
  if (!databaseUrl) {
    throw new Error(
      'DATABASE_URL is not set.\n' +
        'The seed only writes to an explicitly configured local/test database.\n' +
        'Copy QA/.env.example to QA/.env and set it. Never point this at production.',
    )
  }

  const url = new URL(databaseUrl)
  const host = url.hostname
  if (!ALLOWED_DB_HOSTS.includes(host)) {
    throw new Error(
      `Refusing to seed: DATABASE_URL host "${host}" is not a recognised local/test host.\n` +
        `Allowed hosts: ${ALLOWED_DB_HOSTS.join(', ')}.\n` +
        'S-105 QA data must never be written to a shared or production database.',
    )
  }
  return url
}

/** Loads the Prisma Client generated from the *application's* schema. */
function loadPrismaClient(): { Prisma: any; PrismaClient: any } {
  if (!existsSync(prismaSchemaPath)) {
    throw new Error(
      `Cannot find the application Prisma schema at ${prismaSchemaPath}.\n` +
        'Set API_WORKSPACE_DIR (or PRISMA_SCHEMA_PATH) to the backend workspace ' +
        'and run `npx prisma generate --schema <that path>` first.\n' +
        'The QA suite deliberately reuses the app schema rather than copying it.',
    )
  }

  const appDir = path.dirname(prismaSchemaPath)
  const require = createRequire(path.join(appDir, 'noop.js'))
  try {
    return require('@prisma/client')
  } catch (error) {
    throw new Error(
      'Could not load @prisma/client from the backend workspace ' +
        `(${appDir}).\nRun: npx prisma generate --schema ${prismaSchemaPath}\n` +
        `Underlying error: ${(error as Error).message}`,
    )
  }
}

type SchemaFacts = {
  tenantModel: string | null
  hasTenant: boolean
  userModel: string | null
  roleEnum: string | null
  tenantFields: string[]
}

/** Reads the live Prisma schema so the seed never invents structure. */
function readSchemaFacts(Prisma: any): SchemaFacts {
  const models: any[] = Prisma.dmmf.datamodel.models ?? []
  const enums: any[] = Prisma.dmmf.datamodel.enums ?? []
  const names = models.map((m) => m.name)

  const tenantModel = names.find((n) => n.toLowerCase() === 'tenant') ?? null
  const userModel =
    names.find((n) => /^(user|appuser|account|employee|member)$/i.test(n)) ?? null
  const roleEnum =
    enums.find((e) => /role/i.test(e.name))?.name ??
    enums.find((e) => /role/i.test(e.name.replace(/^User/, '')))?.name ??
    null

  const tenant = tenantModel ? models.find((m) => m.name === tenantModel) : null

  return {
    tenantModel,
    hasTenant: Boolean(tenantModel),
    userModel,
    roleEnum,
    tenantFields: tenant ? tenant.fields.map((f: any) => f.name) : [],
  }
}

/**
 * Describes user/role seed support. Never claims to seed users: doing so needs
 * the developer's real role list and the exact required fields (email, password
 * hash, tenant foreign key, role). QA cannot guess those, so the answer stays
 * "not implemented" until a developer supplies them.
 */
function describeUserSupport(facts: SchemaFacts): { supported: boolean; lines: string[] } {
  const lines: string[] = []

  if (!facts.userModel && !facts.roleEnum) {
    lines.push('  BLOCKER: the application schema has no User model and no Role enum.')
    lines.push('  Tenant model found: ' + (facts.tenantModel ?? '(none)'))
    lines.push('  Tenant columns    : ' + (facts.tenantFields.join(', ') || '(none)'))
    lines.push('  S-105 requires one user per role in each tenant. The backend defines')
    lines.push('  zero roles, so there is nothing to create and nowhere to create it.')
    return { supported: false, lines }
  }

  lines.push(`  User model detected: ${facts.userModel ?? '(none)'}`)
  lines.push(`  Role enum detected : ${facts.roleEnum ?? '(none)'}`)
  lines.push('  NOT IMPLEMENTED: user seeding still needs a developer-supplied role list')
  lines.push('  and the exact required fields (email format, password hashing, tenant FK,')
  lines.push('  role). QA will not guess them or write records the app cannot read.')
  return { supported: false, lines }
}

async function seedTenants(prisma: any, facts: SchemaFacts): Promise<SeedResult> {
  const result: SeedResult = { created: [], updated: [], unchanged: [], skipped: [] }

  if (!facts.hasTenant || !facts.tenantModel) {
    throw new Error(
      'No Tenant model found in the application Prisma schema. ' +
        'S-105 cannot seed tenants until the platform schema exposes one.',
    )
  }

  const delegate = prisma[lowerFirst(facts.tenantModel)]

  for (const tenant of SEED_TENANTS) {
    const existing = await delegate.findUnique({ where: { id: tenant.id } })

    if (DRY_RUN) {
      const outcome = !existing
        ? 'would create'
        : existing.name !== tenant.name
          ? 'would update'
          : 'already up to date'
      result.skipped.push(`${tenant.name} (${tenant.country}) id=${tenant.id} -> ${outcome}`)
      continue
    }

    if (!existing) {
      await delegate.create({ data: { id: tenant.id, name: tenant.name } })
      result.created.push(`${tenant.name} (${tenant.country}) id=${tenant.id}`)
      continue
    }

    if (existing.name !== tenant.name) {
      await delegate.update({ where: { id: tenant.id }, data: { name: tenant.name } })
      result.updated.push(`${tenant.name} (${tenant.country}) id=${tenant.id}`)
    } else {
      result.unchanged.push(`${tenant.name} (${tenant.country}) id=${tenant.id}`)
    }
  }

  return result
}

function lowerFirst(value: string): string {
  return value.charAt(0).toLowerCase() + value.slice(1)
}

function report(facts: SchemaFacts, result: SeedResult): void {
  const line = (s = '') => console.log(s)
  const counts = {
    created: result.created.length,
    updated: result.updated.length,
    unchanged: result.unchanged.length,
  }

  line()
  line('=== Asimov HR QA seed report ===')
  line(`mode        : ${DRY_RUN ? 'dry-run (no writes)' : VERIFY ? 'verify' : 'apply'}`)
  line(`database    : ${maskConnectionString(databaseUrl || '(unset)')}`)
  line(`schema      : ${facts.tenantModel ?? 'no Tenant model found'}`)

  line()
  line(`Tenants created  : ${counts.created}`)
  result.created.forEach((r) => line(`  + ${r}`))
  line(`Tenants updated  : ${counts.updated}`)
  result.updated.forEach((r) => line(`  ~ ${r}`))
  line(`Tenants unchanged: ${counts.unchanged}`)
  result.unchanged.forEach((r) => line(`  = ${r}`))
  result.skipped.forEach((r) => line(`  ? ${r}`))

  line()
  const users = describeUserSupport(facts)
  line('Users per role    : NOT SEEDED')
  users.lines.forEach((l) => line(l))

  line()
  line(`Country column    : ${facts.tenantFields.includes('country') ? 'present' : 'MISSING'}`)
  if (!facts.tenantFields.includes('country')) {
    line('  Tenant has no country/region column, so Bluepeak=India and')
    line('  Northwind=US are tracked in QA fixtures only, not in the database.')
  }
  line()
}

async function main(): Promise<void> {
  const url = assertSafeDatabase()
  process.env.DATABASE_URL = url.toString()
  if (!process.env.DIRECT_URL) process.env.DIRECT_URL = url.toString()

  const { Prisma, PrismaClient } = loadPrismaClient()
  const facts = readSchemaFacts(Prisma)
  const prisma = new PrismaClient()

  try {
    const result = await seedTenants(prisma, facts)

    if (VERIFY) {
      const delegate = prisma[lowerFirst(facts.tenantModel!)]
      const missing: string[] = []
      for (const tenant of SEED_TENANTS) {
        const row = await delegate.findUnique({ where: { id: tenant.id } })
        if (!row) missing.push(tenant.name)
      }
      if (missing.length) {
        throw new Error(`Seed verification failed. Missing tenants: ${missing.join(', ')}`)
      }
      console.log(`Seed verification OK: ${SEED_TENANTS.length} tenants present.`)
    } else {
      report(facts, result)
    }
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((error) => {
  console.error('\n=== SEED FAILED ===')
  console.error((error as Error).message)
  process.exitCode = 1
})
