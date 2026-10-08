import { describe, it, expect } from 'vitest'
import people from '../i18n/en/people.json'
import {
  MAX_IMPORT_BYTES, REASON_CODES, buildCsv, buildErrorCsv, csvCell, parseImportError, validateImportFile,
} from './importLogic'
import type { ImportBadRow } from './types'

describe('file checks', () => {
  it('accepts a normal csv', () => {
    expect(validateImportFile({ name: 'people.csv', size: 1000 })).toBeNull()
    expect(validateImportFile({ name: 'PEOPLE.CSV', size: MAX_IMPORT_BYTES })).toBeNull()
  })
  it('rejects other types and big files', () => {
    expect(validateImportFile({ name: 'people.xlsx', size: 10 })).toBe('type')
    expect(validateImportFile({ name: 'people', size: 10 })).toBe('type')
    expect(validateImportFile({ name: 'big.csv', size: MAX_IMPORT_BYTES + 1 })).toBe('size')
  })
})

describe('csv cells', () => {
  it('quotes commas, quotes and new lines', () => {
    expect(csvCell('plain')).toBe('plain')
    expect(csvCell('a,b')).toBe('"a,b"')
    expect(csvCell('say "hi"')).toBe('"say ""hi"""')
    expect(csvCell('two\nlines')).toBe('"two\nlines"')
  })
  it('stops formulas from running in a spreadsheet', () => {
    expect(csvCell('=SUM(A1)')).toBe("'=SUM(A1)")
    expect(csvCell('+91 98765')).toBe("'+91 98765")
    expect(csvCell('@cmd')).toBe("'@cmd")
  })
  it('joins rows with line breaks', () => {
    expect(buildCsv([['a', 'b'], ['c', 'd']])).toBe('a,b\r\nc,d\r\n')
  })
})

describe('error file', () => {
  const bad: ImportBadRow[] = [
    {
      row: 4,
      values: { code: 'AS-2003', name: '', email: 'nope', department: 'Finance' },
      errors: ['name_required', 'email_invalid'],
    },
  ]
  it('has a header, the row number, the original values and the reasons', () => {
    const lines = buildErrorCsv(bad, c => `R:${c}`).trim().split('\r\n')
    expect(lines[0]).toBe('row,code,name,email,designation,department,location,manager_code,joining_date,problems')
    expect(lines[1]).toBe('4,AS-2003,,nope,,Finance,,,,R:name_required; R:email_invalid')
  })
  it('has one line per bad row', () => {
    const rows = [bad[0], { ...bad[0], row: 9 }]
    expect(buildErrorCsv(rows, c => c).trim().split('\r\n')).toHaveLength(3)
  })
})

describe('reasons', () => {
  it('every reason code has a readable text', () => {
    for (const code of REASON_CODES) {
      expect(people.import.reasons[code]).toBeTruthy()
    }
  })
})

describe('API errors', () => {
  it('reads the missing columns', () => {
    expect(parseImportError('{"error":"missing_columns","columns":["email","name"]}')).toEqual({
      kind: 'columns', columns: ['email', 'name'],
    })
  })
  it('falls back to a general error', () => {
    expect(parseImportError('Internal Server Error')).toEqual({ kind: 'generic' })
    expect(parseImportError('{"error":"empty file"}')).toEqual({ kind: 'generic' })
  })
})