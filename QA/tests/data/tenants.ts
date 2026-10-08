/**
 * Canonical S-105 seed data for the two required test tenants.
 *
 * Tenant UUIDs are *derived deterministically* (UUIDv5, SHA-1) from the tenant
 * key with a fixed QA namespace. That means the same tenant always gets the same
 * id on every machine and every run, so the API/UI tests can reference a tenant
 * id without first reading it back from the database, and re-running the seed
 * updates the existing row instead of creating a duplicate.
 */
import { createHash } from 'node:crypto'

/**
 * Private namespace for Asimov QA fixtures.
 * Fixed forever - changing it would change every seeded tenant id.
 */
const QA_NAMESPACE = '1b671a64-40d5-491e-99b0-da01ff1f3341'

/** RFC 4122 v5 (SHA-1, name-based) UUID. */
function uuidv5(name: string, namespace: string): string {
  const nsBytes = Buffer.from(namespace.replace(/-/g, ''), 'hex')
  const nameBytes = Buffer.from(name, 'utf8')
  const hash = createHash('sha1').update(Buffer.concat([nsBytes, nameBytes])).digest()

  const bytes = Buffer.from(hash.subarray(0, 16))
  bytes[6] = (bytes[6]! & 0x0f) | 0x50 // version 5
  bytes[8] = (bytes[8]! & 0x3f) | 0x80 // RFC 4122 variant

  const hex = bytes.toString('hex')
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32),
  ].join('-')
}

export type TenantFixture = {
  /** Stable machine key used in emails, ids and reports. */
  key: string
  /** Value written to platform."Tenant"."name" - the real column. */
  name: string
  /**
   * Country the tenant operates in, per the S-105 requirement
   * (Bluepeak = India, Northwind = US).
   *
   * NOTE: platform."Tenant" currently has no country column, so this is
   * metadata for QA reports only and is not written to the database.
   * See tests/README.md "Blockers" - the developer needs a migration.
   */
  country: string
  /** Deterministic primary key. */
  id: string
}

const TENANT_KEYS = [
  { key: 'tenant-a', name: 'Bluepeak', country: 'India' },
  { key: 'tenant-b', name: 'Northwind', country: 'US' },
] as const

export const SEED_TENANTS: readonly TenantFixture[] = TENANT_KEYS.map((t) => ({
  ...t,
  id: uuidv5(`${QA_NAMESPACE}:tenant:${t.key}`, QA_NAMESPACE),
}))

export function tenantByKey(key: string): TenantFixture {
  const found = SEED_TENANTS.find((t) => t.key === key)
  if (!found) throw new Error(`Unknown seed tenant key: ${key}`)
  return found
}

export function tenantById(id: string): TenantFixture | undefined {
  return SEED_TENANTS.find((t) => t.id === id)
}

/**
 * Roles the QA suite knows about.
 *
 * The application currently defines NO roles: apps/api/prisma/schema.prisma has
 * no `Role` enum and no `User` model. Rather than invent roles that the backend
 * would reject, the seed reads the roles from the live Prisma schema and only
 * creates users for roles that actually exist. See discoverRoles() in seed.ts.
 */
export const DISCOVERED_ROLE_HOLDER = 'roleHolder'
