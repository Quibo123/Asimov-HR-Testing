/**
 * Tenant scope for queries.
 *
 * RULE: NEVER query a tenant-owned table without forTenant(tenantId).
 * Every findMany / findFirst / update / delete `where` must spread this in,
 * otherwise one customer can read or change another customer's data.
 */
export function forTenant(tenantId: string) {
  if (!tenantId) {
    throw new Error("forTenant called without a tenantId");
  }
  return { tenantId } as const;
}