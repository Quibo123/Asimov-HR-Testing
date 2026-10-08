import type { ImportBadRow } from './types'

export const IMPORT_COLUMNS = [
  'code', 'name', 'email', 'designation', 'department', 'location', 'manager_code', 'joining_date',
] as const

// Every reason the API can send. Each one needs a text in people.json (a test checks this).
export const REASON_CODES = [
  'code_required', 'code_exists', 'code_duplicate', 'name_required', 'email_invalid',
  'department_unknown', 'location_unknown', 'manager_unknown', 'date_invalid',
] as const

export const MAX_IMPORT_BYTES = 5 * 1024 * 1024

export type FilePickError = 'type' | 'size'

// Checked in the browser before anything is sent
export function validateImportFile(file: { name: string; size: number }): FilePickError | null {
  if (!file.name.toLowerCase().endsWith('.csv')) return 'type'
  if (file.size > MAX_IMPORT_BYTES) return 'size'
  return null
}

// Quotes cells that need it. A leading = + - or @ gets a ' in front, so Excel cannot run it as a formula.
export function csvCell(value: string): string {
  let s = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value
  if (/[",\r\n]/.test(s)) s = `"${s.replace(/"/g, '""')}"`
  return s
}

export const buildCsv = (rows: string[][]): string =>
  rows.map(r => r.map(csvCell).join(',')).join('\r\n') + '\r\n'

export const buildTemplateCsv = (): string =>
  buildCsv([
    [...IMPORT_COLUMNS],
    ['AS-3001', 'Example Person', 'example.person@example.com', 'Software Engineer', 'Engineering', 'Chennai', 'AS-1002', '2026-10-12'],
  ])

// The error file: the original columns, plus the reasons. It can be fixed and uploaded again as it is.
export function buildErrorCsv(rows: ImportBadRow[], reason: (code: string) => string): string {
  return buildCsv([
    ['row', ...IMPORT_COLUMNS, 'problems'],
    ...rows.map(r => [
      String(r.row),
      ...IMPORT_COLUMNS.map(c => r.values[c] ?? ''),
      r.errors.map(reason).join('; '),
    ]),
  ])
}

export type ImportErrorInfo = { kind: 'columns'; columns: string[] } | { kind: 'generic' }

// The API answers a bad header with JSON like {"error":"missing_columns","columns":["email"]}
export function parseImportError(message: string): ImportErrorInfo {
  try {
    const body: unknown = JSON.parse(message)
    if (typeof body === 'object' && body !== null && 'columns' in body) {
      const columns = (body as { columns: unknown }).columns
      if (Array.isArray(columns) && columns.length > 0) return { kind: 'columns', columns: columns.map(String) }
    }
  } catch {
    // not JSON
  }
  return { kind: 'generic' }
}