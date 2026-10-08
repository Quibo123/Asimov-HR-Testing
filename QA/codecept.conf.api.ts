/**
 * API-only run: `npx codeceptjs run --config codecept.conf.api.ts`
 *
 * Mounts only the REST helper, so no browser is launched for API runs.
 */
import { restHelper, sharedPlugins } from './codecept.conf'
import { stepTimeoutMs } from './tests/support/env'

export const config: CodeceptJS.MainConfig = {
  name: 'asimov-hr-qa-api',
  tests: './tests/api/*_test.ts',
  output: './artifacts',
  require: ['tsx/esm'],
  noGlobals: true,
  stepTimeout: stepTimeoutMs,

  helpers: {
    REST: { ...restHelper },
  },

  include: {
    I: './tests/support/steps.ts',
  },

  plugins: { ...sharedPlugins },
}
