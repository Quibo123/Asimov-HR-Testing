/**
 * Shared CodeceptJS configuration for the Asimov HR QA suite.
 *
 * Two helpers, exactly as S-105 requires:
 *   - Playwright -> UI / browser automation (tests/ui)
 *   - REST       -> API testing              (tests/api)
 *
 * All base URLs come from environment variables (FRONTEND_URL / API_URL) so the
 * same suite runs against localhost in development, a local stack in CI, and a
 * staging stack later (AS-122) without touching test code.
 *
 * Export the option blocks separately so codecept.conf.api.ts / codecept.conf.ui.ts
 * can mount only the helper they need and avoid starting a browser for API runs.
 */
import os from 'node:os'
import { createRequire } from 'node:module'
import { frontendUrl, apiUrl, headed, stepTimeoutMs } from './tests/support/env'

// Local package versions for the Allure environment card. Only public
// version numbers are exposed - never credentials or connection strings.
const localRequire = createRequire(import.meta.url)
const localPackage = localRequire('./package.json') as {
  dependencies?: Record<string, string>
  devDependencies?: Record<string, string>
}
const localDependencies = {
  ...localPackage.dependencies,
  ...localPackage.devDependencies,
}

export const playwrightHelper = {
  browser: 'chromium',
  url: frontendUrl,
  show: headed,
  restart: 'session',
  // One sign-in per run: the browser context is reused across scenarios and
  // cookies/localStorage are NOT wiped between them, so the Supabase session
  // from the dedicated login test carries over to the rest of the suite.
  keepBrowserState: true,
  keepCookies: true,
  windowSize: '1440x900',

  // Failure evidence, written under ./artifacts
  disableScreenshots: false,
  fullPageScreenshots: true,
  uniqueScreenshotNames: true,

  // Playwright trace: recorded for every test, retained only on failure.
  // `keepTraceForPassedTests` is left false so a green run uploads nothing.
  trace: true,
  keepTraceForPassedTests: false,
} as const

export const restHelper = {
  endpoint: apiUrl,
  timeout: 30000,
  prettyPrintJson: false,
  keepUserSession: false,
  defaultHeaders: {
    accept: 'application/json',
  },
} as const

export const sharedPlugins = {
  // Enabled by default in CodeceptJS 4 (on: 'fail'); kept explicit so the
  // S-105 "screenshot on failure" requirement is visible in this file.
  screenshot: { enabled: true, on: 'fail', fileName: 'failure' },
  retryFailedStep: { enabled: true, retries: 1 },

  // Allure Report 3 (allure-codeceptjs). Results are appended to
  // ./allure-results on every run; the HTML report is generated on demand
  // with `npm run allure:generate`. Screenshots taken by the plugin above
  // are attached automatically through `test.artifacts.screenshot`.
  allure: {
    enabled: true,
    require: 'allure-codeceptjs',
    resultsDir: 'allure-results',
    environmentInfo: {
      os_platform: os.platform(),
      os_release: os.release(),
      os_version: os.version(),
      node_version: process.version,
      codeceptjs_version: localDependencies.codeceptjs ?? 'unknown',
      playwright_version: localDependencies.playwright ?? 'unknown',
      browser: playwrightHelper.browser,
    },
  },
} as const

export const config: CodeceptJS.MainConfig = {
  name: 'asimov-hr-qa',
  tests: './tests/**/*_test.ts',
  output: './artifacts',
  require: ['tsx/esm'],
  noGlobals: true,
  stepTimeout: stepTimeoutMs,

  helpers: {
    Playwright: { ...playwrightHelper },
    REST: { ...restHelper },
  },

  include: {
    I: './tests/support/steps.ts',
  },

  plugins: { ...sharedPlugins },
}
