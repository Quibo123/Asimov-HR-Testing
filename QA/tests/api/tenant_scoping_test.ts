/**
 * @api
 * Covers the tenant isolation middleware the backend actually implements today:
 * apps/api/src/platform/tenant.ts requires a valid UUID in `X-Tenant-ID` on every
 * non-public route and returns 400 when it is missing or malformed.
 *
 * These are the real, currently-implemented tenancy guarantees. There is no
 * login/authorization behaviour to test yet (see tests/README.md "Blockers").
 */
import { strict as assert } from 'node:assert'
import { SEED_TENANTS, tenantByKey } from '../data/tenants'

Feature('Asimov HR tenant scoping @api')

Scenario('tenant-scoped route rejects a request without X-Tenant-ID @api', async ({ I }) => {
  const response = await I.sendGetRequest('/core/ping', {})

  assert.equal(response.status, 400, 'missing tenant header must be rejected')
  assert.equal(response.data.error, 'Bad Request')
})

Scenario('tenant-scoped route rejects a malformed tenant id @api', async ({ I }) => {
  const response = await I.sendGetRequest('/core/ping', { 'X-Tenant-ID': 'not-a-uuid' })

  assert.equal(response.status, 400, 'malformed tenant header must be rejected')
})

Scenario('tenant-scoped route accepts a seeded tenant id @api @smoke', async ({ I }) => {
  const bluepeak = tenantByKey('tenant-a')

  const response = await I.sendGetRequest('/core/ping', { 'X-Tenant-ID': bluepeak.id })

  assert.equal(response.status, 200, 'a valid seeded tenant id must be accepted')
  assert.deepEqual(response.data, { module: 'core', ok: true })
})

Scenario('every module ping endpoint is reachable for both seeded tenants @api', async ({ I }) => {
  const modules = ['core', 'onboard', 'talently', 'time']

  for (const tenant of SEED_TENANTS) {
    for (const module of modules) {
      const response = await I.sendGetRequest(`/${module}/ping`, { 'X-Tenant-ID': tenant.id })

      assert.equal(response.status, 200, `/${module}/ping should be 200 for ${tenant.name}`)
      assert.equal(
        response.data.module,
        module,
        `response should identify the ${module} module`,
      )
      assert.equal(response.data.ok, true, `${module} should report ok for ${tenant.name}`)
    }
  }
})

Scenario('unknown route returns 404 for a valid tenant @api', async ({ I }) => {
  const response = await I.sendGetRequest('/this-route-does-not-exist', {
    'X-Tenant-ID': SEED_TENANTS[0]!.id,
  })

  assert.equal(response.status, 404)
})
