/**
 * UI-only run: `npx codeceptjs run --config codecept.conf.ui.ts`
 *
 * Mounts only the Playwright helper. Traces and failure screenshots are
 * written under ./artifacts.
 */
import { playwrightHelper, sharedPlugins } from './codecept.conf'
import { stepTimeoutMs } from './tests/support/env'

export const config: CodeceptJS.MainConfig = {
  name: 'asimov-hr-qa-ui',
  tests: './tests/ui/*_test.ts',
  output: './artifacts',
  require: ['tsx/esm'],
  noGlobals: true,
  stepTimeout: stepTimeoutMs,

  helpers: {
    Playwright: { ...playwrightHelper },
  },

  include: {
    I: './tests/support/steps.ts',
  },

  plugins: { ...sharedPlugins },
}
