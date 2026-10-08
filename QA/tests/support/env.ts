/**
 * Central environment resolution for the Asimov HR QA suite.
 *
 * Every base URL, database URL and credential is read from an environment
 * variable. Nothing is hard-coded to a hosted environment, and nothing is
 * ever printed. Local development, CI and (future) staging differ only in
 * the values of these variables, never in test code.
 */
import 'dotenv/config'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const QA_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const REPO_DIR = path.resolve(QA_DIR, '..')

function readDotEnv(): void {
  const candidates = [
    process.env.QA_ENV_FILE,
    path.join(QA_DIR, '.env'),
    path.join(REPO_DIR, '.env'),
  ].filter(Boolean) as string[]

  for (const file of candidates) {
    if (!existsSync(file)) continue
    // dotenv never overwrites variables already present in the environment,
    // so real CI secrets always win over a local .env.
    process.loadEnvFile(file)
  }
}
readDotEnv()

function trimmed(name: string): string {
  const value = process.env[name]
  return typeof value === 'string' ? value.trim() : ''
}

function required(name: string, purpose: string): string {
  const value = trimmed(name)
  if (!value) {
    throw new Error(
      `Missing required environment variable ${name} (${purpose}).\n` +
        `Set it in QA/.env, your shell, or as a GitHub Actions variable.\n` +
        `See QA/tests/README.md for the full variable list.`,
    )
  }
  return value.replace(/\/+$/, '')
}

/** Base URL of the Asimov HR frontend (the Vite dev server by default). */
export const frontendUrl = required('FRONTEND_URL', 'base URL of the frontend under test')

/** Base URL of the Asimov HR API (the Fastify server by default). */
export const apiUrl = required('API_URL', 'base URL of the backend API under test')

/**
 * Absolute path to the backend workspace that owns the Prisma schema.
 * The seed script generates its Prisma client from this location so the QA
 * suite always targets the *real* application schema instead of a copy.
 */
export const apiWorkspaceDir = (() => {
  const fromEnv = trimmed('API_WORKSPACE_DIR')
  return fromEnv ? path.resolve(fromEnv) : path.resolve(REPO_DIR, 'app/backend/apps/api')
})()

/** Absolute path to the repository's prisma/schema.prisma. */
export const prismaSchemaPath = (() => {
  const fromEnv = trimmed('PRISMA_SCHEMA_PATH')
  return fromEnv ? path.resolve(fromEnv) : path.join(apiWorkspaceDir, 'prisma/schema.prisma')
})()

/** Connection string for the local/test PostgreSQL instance used by the seed. */
export const databaseUrl = trimmed('DATABASE_URL')

/** Run the browser headed (local debugging only; CI is always headless). */
export const headed = trimmed('QA_HEADED') === 'true'

/** Fail immediately if the target application is not reachable. */
export const requireApp = trimmed('QA_REQUIRE_APP') !== 'false'

/** Per-test step timeout in milliseconds. */
export const stepTimeoutMs = Number(trimmed('CODECEPT_TIMEOUT_MS') || 60000)

/**
 * Credentials for a seeded user. Deliberately optional: the application has
 * no authentication yet (see tests/README.md "Blockers"). When the developer
 * adds sign-in, set these from a GitHub secret and the same tests can use them.
 */
export const testUsername = trimmed('TEST_USERNAME')
export const testPassword = trimmed('TEST_PASSWORD')

/** Masked diagnostics helper - never reveals a secret value. */
export function describeEnv(): Record<string, string> {
  return {
    FRONTEND_URL: frontendUrl,
    API_URL: apiUrl,
    API_WORKSPACE_DIR: apiWorkspaceDir,
    DATABASE_URL: databaseUrl ? maskConnectionString(databaseUrl) : '(unset)',
    TEST_USERNAME: testUsername ? `${testUsername} (set)` : '(unset - no auth in app yet)',
    TEST_PASSWORD: testPassword ? '(set, masked)' : '(unset - no auth in app yet)',
  }
}

/** Hides the password of a postgres connection string before logging it. */
export function maskConnectionString(url: string): string {
  return url.replace(/\/\/([^:/@]+):([^@]*)@/, (_m, user: string) => `//${user}:***@`)
}
