import { parse } from "csv-parse/sync";
import { z } from "zod";

export const MAX_IMPORT_BYTES = 10 * 1024 * 1024; // 10 MB
export const REQUIRED_COLUMNS = ["name", "email", "phone", "job"] as const;

export type CsvRow = {
  rowNumber: number; // the line number in the CSV file (the header is line 1)
  name: string;
  email: string;
  phone: string;
  job: string;
  file: string;
};

// Reads the CSV text. Throws one clear message if the file itself is unusable.
export function parseResumeCsv(text: string): CsvRow[] {
  let records: Record<string, string>[];
  try {
    records = parse(text, {
      columns: (header: string[]) => header.map((h) => h.trim().toLowerCase()),
      bom: true,
      skip_empty_lines: true,
      trim: true,
    });
  } catch (err) {
    throw new Error(`The CSV could not be read: ${err instanceof Error ? err.message : String(err)}`);
  }

  if (records.length === 0) throw new Error("The CSV has no rows.");

  const have = new Set(Object.keys(records[0]));
  const missing = REQUIRED_COLUMNS.filter((column) => !have.has(column));
  if (missing.length > 0) {
    throw new Error(
      `The CSV is missing these columns: ${missing.join(", ")}. Expected: name, email, phone, job (and optionally file).`,
    );
  }

  return records.map((r, i) => ({
    rowNumber: i + 2,
    name: r.name ?? "",
    email: r.email ?? "",
    phone: r.phone ?? "",
    job: r.job ?? "",
    file: r.file ?? "",
  }));
}

// One row, checked the same way the portal checks an applicant.
export const rowSchema = z.object({
  name: z.string().trim().min(1, "Name is empty.").max(120, "Name is too long."),
  email: z.string().trim().toLowerCase().max(254).email("Email is not valid."),
  phone: z.string().trim().regex(/^[0-9+()\-\s]{7,20}$/, "Phone number is not valid."),
  job: z.string().trim().min(1, "Job is empty."),
  file: z.string().trim().optional(),
});

// ---------- Finding the PDF for a row ----------

// "Asha_K.PDF", "asha k" and "ASHA K" all become "asha k".
export function normaliseKey(value: string): string {
  return value
    .toLowerCase()
    .replace(/\.pdf$/, "")
    .replace(/[^a-z0-9@.]+/g, " ")
    .trim();
}

// `files` are plain file names from the folder, so a "file" column can never point outside it.
export function findResumeFile(
  files: string[],
  row: { name: string; email: string; file?: string },
): { file: string } | { error: string } {
  if (row.file) {
    const wanted = row.file.toLowerCase();
    const exact = files.find((f) => f.toLowerCase() === wanted);
    return exact ? { file: exact } : { error: `The file "${row.file}" is not in the folder.` };
  }

  const byEmail = files.filter((f) => normaliseKey(f) === normaliseKey(row.email));
  const byName = files.filter((f) => normaliseKey(f) === normaliseKey(row.name));
  const matches = byEmail.length > 0 ? byEmail : byName;

  if (matches.length === 1) return { file: matches[0] };
  if (matches.length > 1) {
    return { error: `More than one PDF matches (${matches.join(", ")}). Add a "file" column to the CSV.` };
  }
  return {
    error: `No PDF found. Looked for "${row.email}.pdf" and "${row.name}.pdf" (or add a "file" column).`,
  };
}

export function looksLikePdf(bytes: Buffer): boolean {
  return bytes.length >= 5 && bytes.subarray(0, 5).toString("latin1") === "%PDF-";
}

// ---------- Finding the job for a row ----------

export type JobRef = { id: string; title: string; status: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const normaliseTitle = (value: string) => value.toLowerCase().replace(/\s+/g, " ").trim();

export function pickJob(jobs: JobRef[], value: string): { job: JobRef } | { error: string } {
  const v = value.trim();

  if (UUID.test(v)) {
    const byId = jobs.find((j) => j.id.toLowerCase() === v.toLowerCase());
    return byId ? { job: byId } : { error: `No job with id ${v} in this organisation.` };
  }

  const matches = jobs.filter((j) => normaliseTitle(j.title) === normaliseTitle(v));
  if (matches.length === 1) return { job: matches[0] };
  if (matches.length > 1) {
    return { error: `More than one job is called "${v}". Use the job id in the CSV instead.` };
  }
  return { error: `No job called "${v}" in this organisation.` };
}