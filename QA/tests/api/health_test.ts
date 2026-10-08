/**
 * @api @smoke
 * S-105 sample API test: the real health endpoint on the Fastify backend
 * (apps/api/src/index.ts -> app.get("/health")).
 */
import { strict as assert } from 'node:assert'
import { apiUrl } from '../support/env'

Feature('Asimov HR API @api')

Scenario('health endpoint reports the API is up @api @smoke', async ({ I }) => {
  const response = await I.sendGetRequest('/health')

  assert.equal(
    response.status,
    200,
    `GET ${apiUrl}/health should return 200, got ${response.status}`,
  )
  assert.deepEqual(
    response.data,
    { status: 'ok' },
    'health endpoint must return the documented payload',
  )
})

Scenario('health endpoint needs no tenant header @api', async ({ I }) => {
  // /health is registered in PUBLIC_EXACT in apps/api/src/platform/tenant.ts,
  // so it must stay reachable by CI probes and uptime checks.
  const response = await I.sendGetRequest('/health', {})

  assert.equal(response.status, 200)
})
