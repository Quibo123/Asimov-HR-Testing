# Importing existing resumes

Run from `apps/api`. The CSV and PDFs stay outside the repo (they are personal data).

## CSV
Columns: `name`, `email`, `phone`, `job`, and optionally `file`.
- `job` is a job id (best) or an exact job title. A title shared by several jobs fails that row.
- The PDF is found by the `file` column, else by `<email>.pdf`, else by `<name>.pdf`
  (case, spaces and punctuation are ignored). PDFs must be real PDFs, at most 10 MB.

## Commands
```
npx tsx scripts/import-resumes.ts --tenant <id> --csv <file.csv> --folder <pdfs> --dry-run
npx tsc... (not needed) 
npx tsx scripts/import-resumes.ts --tenant <id> --csv <file.csv> --folder <pdfs>
npx tsx scripts/import-resumes.ts --tenant <id> --csv <file.csv> --folder <pdfs> --invite
```
Always run `--dry-run` first. No emails are sent unless `--invite` is used.

## What it does
- Uploads each PDF to R2 and creates an application with status `IMPORTED`
  ("Imported, awaiting HR review") and source `import`. No portal consent is recorded yet (`consentAt` is empty).
- Same email + same job already exists: skipped (checked before uploading). Safe to run again.
- `--invite`: emails each new candidate a link to the job's questionnaire page (published jobs only).
  Each candidate is invited once. When they submit with the same email, the application is updated,
  consent time is saved, and it is scored like any other application.
- Prints a report (imported, skipped as duplicate, failed with row and reason) and saves
  `import-report-<time>.json` (contains emails, never commit it). Exit code 1 means there are failures to look at.

## Fixing failures
Fix the CSV or the PDF and run the same command again. Rows already imported are skipped.