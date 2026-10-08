import { actor } from 'codeceptjs'
import { SEED_TENANTS, tenantByKey } from '../data/tenants'
import { apiUrl, describeEnv } from './env'

/**
 * Custom step object.
 *
 * `actor()` is required here: providing a custom `I` without it replaces the
 * default actor, which would strip every Playwright/REST method from `I`.
 *
 * Kept small on purpose. S-105 needs shared tenant fixtures and a reachability
 * probe, not a large page-object layer. Page objects belong under tests/ui once
 * the application has real screens to drive.
 */
export default function () {
  return actor({
    /** True when the API base URL answers /health. Reports BLOCKED, never fakes a pass. */
    async apiIsReachable(): Promise<boolean> {
      try {
        const response = await fetch(`${apiUrl}/health`, { signal: AbortSignal.timeout(5000) })
        return response.ok
      } catch {
        return false
      }
    },

    /** Deterministic QA tenant ids, so tests never depend on DB read order. */
    seededTenantIds(): string[] {
      return SEED_TENANTS.map((t) => t.id)
    },

    bluepeakId(): string {
      return tenantByKey('tenant-a').id
    },

    northwindId(): string {
      return tenantByKey('tenant-b').id
    },

    /** Masked environment summary for CI logs. Never prints secrets. */
    envSummary(): string {
      return JSON.stringify(describeEnv(), null, 2)
    },
  })
}
