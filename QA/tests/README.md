# Asimov HR — QA automation (S-105)

Automated test home for Asimov HR: **CodeceptJS + Playwright**, running in **GitHub Actions**, with **repeatable seed data**.

This is the QA-owned test suite. It contains no application code and never modifies the developer branches.

---

## Purpose

| Item | Value |
| --- | --- |
| Requirement | **S-105 — Test repo, CI job and two seed tenants** |
| Branch | `qa/S-105-test-automation` |
| Workflow | `.github/workflows/tests.yml` |
| Helpers | `Playwright` (UI) + `REST` (API) |
| Tags | `@api`, `@ui`, `@smoke` |
| Test tenants | **Bluepeak (India)**, **Northwind (US)** |

The suite is environment-driven. The same tests run against `localhost` today and against staging after **AS-122** — only `FRONTEND_URL` and `API_URL` change, never test code.

---

## Requirements

| Tool | Version used |
| --- | --- |
| Node.js | 24 (`actions/setup-node`, `node-version: 24`) |
| npm | ships with Node 24 |
| CodeceptJS | 4.2.0 |
| Playwright | 1.63.0 (Chromium) |
| TypeScript | 5.9.x |
| tsx | 4.23.x |
| PostgreSQL | 18 (only for the seed; supplied by a service container in CI) |

Everything above is a project-local dependency in `QA/package.json`. No global installs are required.

---

## Installation

```bash
cd QA
npm ci

# Chromium + the OS libraries Playwright needs
npx playwright install --with-deps chromium
```

### Dependency audit

`npm audit --omit=dev` reports **0 vulnerabilities**. `npm audit` reports 8 dev-only advisories (3 high: `axios`, `serialize-javascript`, `@xmldom/xmldom`; plus `mocha`, `uuid`, `diff`, `codeceptjs`, `@codeceptjs/configure`). All are transitive dependencies of `codeceptjs@4.2.0` and are not shipped to the application under test. `npm audit fix` is a no-op (the pinned versions are inside the runner's allowed ranges); only `npm audit fix --force` would move them, and that resolves by changing the CodeceptJS major version. Not applied — a test runner is not worth an unsupported version. Re-check after a `codeceptjs` upgrade.

### Note on `create-codeceptjs`

The config here was written by hand rather than by running `npx create-codeceptjs .`. Verified reason: `create-codeceptjs@1.0.5` installs **`codeceptjs@3`** plus `@codeceptjs/ui`, while this project deliberately uses **CodeceptJS 4** (`tsconfig.json` types, `steps.d.ts` augmentation, `import type` config). Running it would have silently downgraded the runner. It also generates no config files at all — it only installs dependencies and then tells you to run the interactive `npx codeceptjs init`, which would overwrite the finished config. The committed files are equivalent to the Playwright + TypeScript output that `codeceptjs init` produces, plus the REST helper, seed script and CI wiring S-105 needs.

---

## Environment variables

Copy the template and edit it. `.env` is git-ignored; `.env.example` is committed.

```bash
cp .env.example .env
```

| Variable | Required | Purpose |
| --- | --- | --- |
| `FRONTEND_URL` | yes | Frontend base URL. Vite dev server locally. |
| `API_URL` | yes | Backend API base URL. Fastify locally. |
| `DATABASE_URL` | for seeding | Local/test PostgreSQL connection string. **Any non-local host is rejected.** |
| `API_WORKSPACE_DIR` | for seeding | Backend workspace that owns `prisma/schema.prisma`. |
| `PRISMA_SCHEMA_PATH` | optional | Direct path to the Prisma schema, overrides `API_WORKSPACE_DIR`. |
| `QA_HEADED` | optional | `true` runs the browser headed locally. CI is always headless. |
| `TEST_USERNAME` | not yet | Seeded login name. Unused — the app has no login. |
| `TEST_PASSWORD` | not yet | Seeded login password. Unused — the app has no login. |

Resolution order in `tests/support/env.ts`: real environment variables (so CI secrets always win) → `QA/.env` → repository root `.env`.

---

## Starting the application

QA does not start the application for you; use the developer's own commands.

### Backend

```bash
# from the Backend-asimov-test branch
cd apps/api
npm install

# a local/test database only
export DATABASE_URL="postgresql://USER:PASSWORD@127.0.0.1:5432/asimov_test"
export DIRECT_URL="$DATABASE_URL"

npx prisma migrate deploy
npx prisma generate

npm run dev            # tsx watch src/index.ts
```

The server listens on `PORT` (default **3000**) per `apps/api/src/index.ts`.

### Frontend

```bash
# from the Frontend-Asimov-HR branch
npm install
npm run dev            # Vite dev server, default port 5173
```

---

## Running the seed

```bash
cd QA
npm run seed              # create / refresh both tenants (idempotent)
npm run seed:dry-run      # report what would change, write nothing
npm run seed -- --verify  # fail if the seeded tenants are missing
```

The seed reads the **application's own** Prisma schema and Prisma Client — it never keeps a private copy. It:

* writes only the two deterministic QA tenant rows;
* refuses to run against anything other than a local/test database host;
* never truncates, drops or deletes unrelated data;
* prints the database host with the password masked;
* reports which parts of the requirement the schema cannot yet support (see **Blockers**).

---

## Running tests

All commands run from `QA/`.

```bash
npm run test            # full suite (API + UI), excluding documented known issues
npm run test:all        # full suite including known-issue tests (currently 1 failure)
npm run test:api        # API only (no browser is launched)
npm run test:ui         # UI only, excluding documented known issues
npm run test:ui:all     # UI only, including the known-issue tests (expected to fail)
npm run test:smoke      # everything tagged @smoke
npm run test:api:smoke
npm run test:ui:smoke
npm run test:known-issues
npm run test:ci         # exactly what GitHub Actions runs
```

### Tag filtering (CodeceptJS 4 syntax)

Tags live in the scenario titles, so plain `--grep` works:

```bash
npx codeceptjs run --grep @api
npx codeceptjs run --grep @ui
npx codeceptjs run --grep @smoke

# exclude a tag
npx codeceptjs run --grep "@knownissue" --invert
```

`@ui` matches the known-issue test too, because it genuinely is a UI defect.
Use `--invert --grep "@knownissue"` for a green UI run.

| Tag | Meaning |
| --- | --- |
| `@api` | Uses the REST helper. No browser. |
| `@ui` | Uses the Playwright helper. |
| `@smoke` | Fast gate: API health, tenant scoping, app shell, module routes. |
| `@knownissue` | Documents a real application defect. Excluded from CI. |

---

## Failure artifacts

When a UI test fails, CodeceptJS writes evidence to `QA/artifacts/`:

```
artifacts/
├── <scenario>.failed.png                  # full-page screenshot
└── trace/
    └── <uuid>_<scenario>.failed.zip       # Playwright trace
```

* Traces are recorded for every test but **retained only on failure** (`keepTraceForPassedTests: false`), so a green run produces no artifacts.
* Download and inspect a trace with `npx playwright show-trace <file>.zip`.
* `artifacts/` is git-ignored.

---

## Test tenants

| Key | Name | Country | Deterministic id |
| --- | --- | --- | --- |
| `tenant-a` | **Bluepeak** | India | `90dbfe00-20fe-5109-8e60-515042cd0c2c` |
| `tenant-b` | **Northwind** | US | `df6fe6bb-bc26-5135-9c5a-1c43bd7b82ae` |

Ids are UUIDv5 values derived from the tenant key with a fixed QA namespace, so they are identical on every machine and every run. Tests reference them directly instead of reading them back from the database.

Two tenants are defined in `tests/data/tenants.ts` and created by `tests/data/seed.ts`. Per-role users are **not** seeded — see Blockers 1.

---

## CI

`.github/workflows/tests.yml` runs on **every pull request** (no path filter), on pushes to `qa/S-105-test-automation`, and on manual dispatch.

Two parallel jobs:

| Job | What it does |
| --- | --- |
| `api` (`API tests (@api)`) | postgres service → checkout QA branch → Node 24 → `npm ci` → checkout backend branch as a worktree → `npm ci` → `prisma migrate deploy` → `prisma generate` → **seed** → start API → **API tests** |
| `ui` (`UI tests (@ui)`) | same, plus the frontend worktree and Vite → **UI tests** with Chromium |

Both jobs fail non-zero when a test fails or when the application never becomes healthy.

Failure evidence is uploaded only on failure:

| Artifact | Contents | Retention |
| --- | --- | --- |
| `ui-failure-artifacts` | screenshots (`*.png`) + traces (`artifacts/trace/*.zip`) | 14 days |
| `ui-artifacts-full` | entire `QA/artifacts` directory | 14 days |
| `api-artifacts` | `QA/artifacts` for API runs | 14 days |
| `ui-app-logs`, `api-log` | application startup logs | 7 days |

The workflow builds the application from configurable branch refs (`API_BRANCH`, `WEB_BRANCH`) instead of duplicating source. No staging URL is hard-coded anywhere.

The application worktrees are created **inside** the workspace at `app/backend` and `app/frontend`, which is the path every `working-directory:` and `${{ github.workspace }}/…` reference resolves to. A "verify worktree" step fails the job immediately if either checkout is missing. `npm run lint:workflow` cross-checks that each `git worktree add` target matches the paths used by later steps, because a mismatch there fails later with a misleading `npm ci` error.

`npm run lint:workflow` is a dependency-free structural check of the workflow. It is not a substitute for `actionlint`, which additionally validates the GitHub Actions schema and expression syntax:

```bash
actionlint .github/workflows/tests.yml
```

### Repository configuration

Nothing sensitive is stored in the repository. When the application gains real authentication, add:

| Name | Kind | Purpose |
| --- | --- | --- |
| `TEST_USERNAME` | secret | Login for a seeded user |
| `TEST_PASSWORD` | secret | Password for that user |

`FRONTEND_URL` / `API_URL` can stay as workflow-level configuration until AS-122 provides real staging values.

---

## Blockers

These are genuine gaps in the application, not QA limitations. QA implements everything that can be implemented safely and reports the rest rather than faking it.

### 1. No `User` model and no roles — BLOCKS "one user per role in each tenant"

`apps/api/prisma/schema.prisma` contains only `platform."Tenant"` plus four placeholder tables. There is no `User` model and no `Role` enum anywhere in the repository.

QA cannot seed users for roles the backend does not define. `tests/data/seed.ts` introspects the live Prisma schema via `Prisma.dmmf` and reports what it finds; it reports `NOT SEEDED` and prints the blocker.

User seeding is **not** implemented, even once a `User` model appears. Inserting a user requires the developer's real role list plus the exact field contract (email format, password hashing scheme, tenant foreign key, role field name and values). Guessing any of those would write rows the application cannot read back, so the seed deliberately stops at detection. **Follow-up: a developer must supply the role list and the user field contract, then QA adds `seedUsers()`.**

### 2. No authentication — BLOCKS login tests

There is no login endpoint, no token, no session and no login screen:

* backend: no `/login` or `/auth` route; the only routes are `/health` and `/core|onboard|talently|time/ping`
* frontend: no login route or auth UI; `src/main.tsx` has no auth provider

So the smoke UI test covers the web shell instead of a login journey. When sign-in ships, add `tests/ui/auth_test.ts` and switch the smoke scenario over.

### 3. `Tenant` has no country column — BLOCKS storing the country

`platform."Tenant"` is `(id, name, createdAt)`. Bluepeak = India and Northwind = US are therefore tracked in QA fixtures, not in the database. Needs a new migration (QA never edits a committed migration — see `CLAUDE.md` rule 3).

### 4. No staging URL — BLOCKED on AS-122

`FRONTEND_URL` / `API_URL` point at a CI-local stack. No staging host is invented; the placeholders flip to real values when AS-122 lands, with no test edits.

### 5. Frontend defect: SPA navigation does not update the module heading

Found by this suite and documented in `tests/ui/known_issues_test.ts`:

In `src/App.tsx` every module route renders the same component with a different i18n namespace:

```tsx
<Route path="/talently" element={<ModulePage ns="talently" />} />
```

`useTranslation(ns)` only re-evaluates when the component mounts. React Router reuses the same element position across sibling routes, so `ns` never changes and the `<h1>` keeps the previous module's title while the URL changes. Direct navigation and hard reload render correctly.

The test is tagged `@knownissue` and excluded from the CI gate so the suite stays green while the defect stays visible. Delete the file once `App.tsx` is fixed.

---

## Layout

```
QA/
├── tests/
│   ├── api/
│   │   ├── health_test.ts          @api @smoke
│   │   └── tenant_scoping_test.ts  @api
│   ├── ui/
│   │   ├── app_shell_test.ts       @ui @smoke
│   │   └── known_issues_test.ts    @ui @knownissue
│   ├── data/
│   │   ├── tenants.ts              deterministic tenant fixtures
│   │   └── seed.ts                 seed script
│   ├── support/
│   │   ├── env.ts                  environment resolution
│   │   └── steps.ts                custom steps
│   └── README.md                   this file
├── scripts/
│   └── validate-workflow.ts        workflow + safety validation
├── artifacts/                      failure evidence (contents git-ignored,
│                                   .gitkeep kept so the dir exists)
├── codecept.conf.ts                full suite (Playwright + REST)
├── codecept.conf.api.ts            API only
├── codecept.conf.ui.ts             UI only
├── steps.d.ts                      TypeScript augmentation
├── tsconfig.json
├── package.json
├── package-lock.json
├── .env                            local only, git-ignored, never commit
├── .env.example                    documented template
└── .gitignore
```
