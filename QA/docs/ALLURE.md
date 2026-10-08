# Allure Report 3 with CodeceptJS

This document explains how Allure Report 3 is installed and used in the Asimov HR QA suite.

Flow:

```
CodeceptJS run  ->  allure-results (JSON files)  ->  Allure 3  ->  allure-report (HTML)
```

---

## 1. How Allure is installed

Allure is installed **locally in this project** (no global install, no Java required).

```bash
cd QA
npm install --save-dev allure            # Allure Report 3 CLI
npm install --save-dev allure-codeceptjs # CodeceptJS integration
```

Installed versions are listed in `package.json` and can be checked at any time:

```bash
npx allure --version          # Allure Report 3 CLI
npm list --depth=0            # all top level packages
```

The integration (`allure-codeceptjs`) brings `allure-js-commons` and `allure-mocha`
with it, so they do not need to be installed by hand.

## 2. How Allure is integrated with CodeceptJS

The plugin is defined **once** in `codecept.conf.ts`, inside `sharedPlugins`.
`codecept.conf.ui.ts` and `codecept.conf.api.ts` import that object, so every run
(UI, API and the default config) writes Allure results.

```ts
allure: {
  enabled: true,
  require: 'allure-codeceptjs',
  resultsDir: 'allure-results',
  environmentInfo: { /* OS, Node.js, CodeceptJS, Playwright, browser */ },
},
```

Nothing else was changed: helpers, Playwright settings, output directory, tests,
plugins (`screenshot`, `retryFailedStep`) and the existing npm scripts are untouched.

`Mochawesome` was **not** installed in this project and nothing was removed.
The only `mocha` package present is a normal dependency of CodeceptJS itself.

## 3. How to run the tests

The application under test must be running first, otherwise every test fails with
`ERR_CONNECTION_REFUSED`. For the **new frontend**
(`app/Asimov-HR-Testing-Frontend-Asimov-HR`) the local stack is three processes:

| Process | Command | URL |
| --- | --- | --- |
| Frontend (Vite) | `npm run dev -- --host 127.0.0.1 --port 5173` (run in the frontend dir) | `http://127.0.0.1:5173` |
| Mock API | `node mock-api.cjs` (in `app/Asimov-HR-Testing-mock-only`, listens on **3000**) | `http://127.0.0.1:3000` |
| Local auth stand-in | `node scripts/fake-supabase.cjs` (this repo) | `http://127.0.0.1:54321` |

Wiring lives in the frontend's git-ignored `.env.local`
(`VITE_SUPABASE_URL` → 54321, `VITE_API_URL` → 3000). Sign-in uses the QA
account from `QA/.env` (`TEST_USERNAME` / `TEST_PASSWORD`), which the tests read
through `tests/support/env` — credentials are never written in test code.

The UI suite resets the mock's seed data before every scenario
(`POST /__reset`, called from the `Before` hook in `tests/ui/app_shell_test.ts`),
so the scenarios that invite, re-role and remove a user, decide approvals, and
upload or delete a profile document stay repeatable across runs. The mock URL
defaults to `http://127.0.0.1:3000` and can be overridden with `QA_MOCK_API_URL`.

```bash
npm test           # default suite (skips @knownissue tests)
npm run test:ui    # UI only
npm run test:api   # API only
npm run test:all   # everything, including @knownissue
```

Each run appends new files to `allure-results`.

### UI-only run with its own Allure report

`--override` redirects only this run's results, so the combined history in
`allure-results` stays untouched:

```bash
cd QA
rm -rf allure-results-ui allure-report-ui && \
QA_HEADED=true npx codeceptjs run --config codecept.conf.ui.ts --invert --grep "@knownissue" \
  --override '{"plugins":{"allure":{"enabled":true,"require":"allure-codeceptjs","resultsDir":"allure-results-ui"}}}' && \
npx allure generate allure-results-ui -o allure-report-ui && \
npx allure open allure-report-ui
```

Drops `@knownissue` tests, writes the UI results only, builds `allure-report-ui`
and serves it at the printed `http://localhost:<port>`. Both directories are
git-ignored. The suite signs in **once per run** (`keepBrowserState` in
`codecept.conf.ts` keeps the session between scenarios), so the auth stand-in
logs a single password sign-in per run.

## 4. How to generate the report

```bash
npm run allure:generate
```

Which runs:

```bash
rm -rf allure-report && allure generate allure-results -o allure-report
```

Why `rm -rf allure-report`? Allure Report 3 has **no `--clean` flag** (Allure 2 had it).
Generating into an existing report directory keeps stale data, so the old report is
removed first. The report is generated again from `allure-results`, so nothing is lost.
`allure-report` and `allure-results` are both ignored by git.

## 5. How to open the report

```bash
npm run allure:open      # serves ./allure-report
```

## 6. How to serve fresh results directly

```bash
npm run allure:serve     # builds a report from ./allure-results and serves it
```

Both commands print `Allure is running on http://localhost:<port>` and start a local
web server. Open that URL in a browser.

## 7. Where the files are

| Path | Content |
| --- | --- |
| `allure-results/` | Raw result files, one JSON per test + attachments |
| `allure-report/` | Generated HTML report (open `index.html` through the CLI) |
| `artifacts/` | Playwright screenshots and traces (unchanged behaviour) |

### Multiple runs

`allure-results` is **append only**. Every run adds new files, and Allure merges them
into one report. Tests with the same name are combined by their `historyId`:

* a later successful attempt is shown as **passed**
* an earlier failed attempt of the same test is shown as a **retry**

To start from scratch, delete `allure-results` (this is the only way to forget old runs).

## 8. Screenshots and attachments

The existing `screenshot` plugin (`on: 'fail'`) still writes PNG files to `artifacts/`.
`allure-codeceptjs` picks the path up from `test.artifacts.screenshot` and attaches the
image to the failing test automatically. **No test code changes are needed.**

To attach extra files inside a test:

```ts
import { attachment, ContentType } from 'allure-js-commons'
await attachment('response', JSON.stringify(body), ContentType.JSON)
```

## 9. Environment information

`environment.properties` is written into `allure-results` and shown on the report
overview page. It contains only public information:

* OS platform / release / version
* Node.js version
* CodeceptJS version
* Playwright version
* Browser name

No passwords, tokens, cookies or connection strings are written.

## 10. Homebrew

Homebrew was installed with the official installer, as the normal user `kali`
(never as root), into the standard Linux prefix.

Check it:

```bash
brew --version
brew --prefix      # /home/linuxbrew/.linuxbrew
brew doctor
brew config
```

Shell setup: the login shell is **Zsh**, so `~/.zshrc` contains:

```sh
eval "$(/home/linuxbrew/.linuxbrew/bin/brew shellenv)"
```

Homebrew is only used as a tool manager here. It does not replace `apt`.

## 11. How to update

```bash
cd QA
npm install --save-dev allure@latest allure-codeceptjs@latest
npm list allure allure-codeceptjs
npx allure --version
```

For Homebrew:

```bash
brew update
brew --version
```

## 12. Troubleshooting

| Problem | What to do |
| --- | --- |
| `no allure-results found` | Run the tests first: `npm test` |
| Report looks stale or incomplete | Remove `allure-report`, then `npm run allure:generate` |
| `ERR_CONNECTION_REFUSED` on port 5173 / 3000 | Start the frontend and the backend, then re-run the tests |
| No screenshots in the report | Screenshots are only taken on failure, and only for browser (UI) tests |
| `brew: command not found` | Open a new shell, or run `eval "$(/home/linuxbrew/.linuxbrew/bin/brew shellenv)"` |
| `npx allure` asks to install a package | Run `npm install` inside `QA` so the local install is restored |
| Plugin not loaded | Check `plugins.allure.enabled` is `true` in `codecept.conf.ts` |
| Old data in the report | Delete `allure-results` to forget previous runs, then re-run the tests |

## 13. Quick reference

```bash
cd QA
npm test                  # run tests (writes allure-results)
npm run allure:generate   # build allure-report
npm run allure:open       # open the report in a browser
npm run allure:serve      # build + serve directly from allure-results
npx allure --version      # Allure CLI version
npx codeceptjs --version  # CodeceptJS version
```
