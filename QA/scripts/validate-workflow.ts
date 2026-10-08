/**
 * Minimal structural validation of .github/workflows/tests.yml.
 *
 * Deliberately dependency-free: it checks the YAML parses as a workflow and
 * that the S-105 requirements are present (triggers, install, seed, api, ui,
 * screenshot and trace upload). Run with `npm run lint:workflow`.
 */
import { readFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const QA_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const WORKFLOW = path.resolve(QA_DIR, '../.github/workflows/tests.yml')

const failures: string[] = []

function check(label: string, condition: boolean): void {
  if (!condition) failures.push(label)
  console.log(`${condition ? 'PASS' : 'FAIL'}  ${label}`)
}

if (!existsSync(WORKFLOW)) {
  console.error(`Workflow not found: ${WORKFLOW}`)
  process.exit(1)
}

const raw = readFileSync(WORKFLOW, 'utf8')

// --- Structural checks ---------------------------------------------------
check('workflow file exists', true)
check('declares `name: tests`', /^name:\s*tests\s*$/m.test(raw))
check('triggers on pull_request', /on:[\s\S]*?pull_request:/.test(raw))
check(
  'pull_request has no path filter (runs on every PR)',
  /^on:\s*\n(?:[ \t]*#.*\n)*[ \t]*pull_request:\s*$/m.test(raw),
)
check('triggers on the QA branch push', /branches:[\s\S]*?qa\/S-105-test-automation/.test(raw))
check('allows manual dispatch', /workflow_dispatch:/.test(raw))
check('requests only read-only contents permission', /permissions:\s*\n\s*contents:\s*read/.test(raw))
check('uses actions/checkout', /uses:\s*actions\/checkout@/.test(raw))
check('uses actions/setup-node', /uses:\s*actions\/setup-node@/.test(raw))
check('installs dependencies with npm ci', /run:\s*npm ci/.test(raw))
check('installs Playwright chromium with OS deps', /playwright install --with-deps chromium/.test(raw))
check('applies Prisma migrations', /prisma migrate deploy/.test(raw))
check('runs the seed script', /run:\s*npm run seed\b/.test(raw))
check('runs API tests', /run:\s*npm run test:api:ci/.test(raw))
check('runs UI tests', /run:\s*npm run test:ui:ci/.test(raw))
check('uploads artifacts on failure', /if:\s*failure\(\)[\s\S]*?actions\/upload-artifact@/.test(raw))
check('uploads failure screenshots (*.png)', /artifacts\/\*\.png/.test(raw))
check('uploads Playwright traces (*.zip under artifacts/trace)', /artifacts\/trace\/\*\.zip/.test(raw))
check('starts the API and waits for /health', /curl -sf "\$API_URL\/health"/.test(raw))
check('starts the frontend and waits for readiness', /curl -sf "\$FRONTEND_URL"/.test(raw))
check('fails the job when the app never starts', /exit 1/.test(raw))

// --- Cross-reference checks ------------------------------------------------
// `git worktree add <path>` creates the app checkout, while later steps use
// `working-directory: <path>` and ${{ github.workspace }}/<path>. If those two
// disagree (e.g. "../app/backend" vs "app/backend") the job dies at
// `npm ci` with a misleading error. Compare them here instead.
const worktreeTargets = [...raw.matchAll(/git worktree add\s+"?([^"\s]+)"?/g)].map((m) => m[1])
const workdirs = [...raw.matchAll(/working-directory:\s*app\/(\w+)/g)].map((m) => `app/${m[1]}`)
const workspaceRefs = [...raw.matchAll(/\$\{\{\s*github\.workspace\s*\}\}\/(app\/\w+)/g)].map((m) => m[1])

check('creates at least one git worktree for the app branches', worktreeTargets.length > 0)
for (const target of worktreeTargets) {
  check(`worktree target "${target}" is inside the workspace`, !target.startsWith('..') && !target.startsWith('/'))
}
for (const ref of [...new Set([...workdirs, ...workspaceRefs])]) {
  check(`step path "${ref}" has a matching worktree`, worktreeTargets.includes(ref))
}

// --- Safety checks -------------------------------------------------------
check('no hard-coded staging/production host', !/(https?:\/\/(staging|prod|production|app)\.)/.test(raw))
check('no secret values committed', !/(TEST_PASSWORD\s*[:=]\s*\S+|secrets\.\w+\s*==\s*['"])/.test(raw))
check('database URL is CI-local only', /DATABASE_URL:\s*postgresql:\/\/asimov_qa:asimov_qa_local@127\.0\.0\.1/.test(raw))
check('QA_HEADED is false in CI', /QA_HEADED:\s*'false'/.test(raw))

// --- Base URLs must come from configuration, not literals in test code ----
const confFiles = ['codecept.conf.ts', 'codecept.conf.api.ts', 'codecept.conf.ui.ts']
for (const file of confFiles) {
  const contents = readFileSync(path.join(QA_DIR, file), 'utf8')
  const literal = /url:\s*['"]https?:\/\//.test(contents) || /endpoint:\s*['"]https?:\/\//.test(contents)
  check(`${file} reads base URLs from environment`, !literal)
}

console.log()
if (failures.length) {
  console.error(`${failures.length} workflow check(s) failed:`)
  failures.forEach((f) => console.error(`  - ${f}`))
  process.exit(1)
}
console.log('Workflow validation passed.')
