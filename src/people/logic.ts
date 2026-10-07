import type { EmployeeStatus } from './types'

export const PAGE_SIZE = 20
export const EMPLOYEE_STATUSES: EmployeeStatus[] = ['active', 'on_leave', 'exited']

// Anything that is not a known status is ignored, so a hand-edited URL cannot break the page
export const parseEmployeeStatus = (v: string | null): EmployeeStatus | '' =>
  EMPLOYEE_STATUSES.find(s => s === v) ?? ''

export function parsePage(v: string | null): number {
  const n = Number(v)
  return Number.isInteger(n) && n >= 1 ? n : 1
}

export type DirectoryQuery = {
  q: string
  location: string
  department: string
  status: EmployeeStatus | ''
  page: number
}

export function toApiParams(query: DirectoryQuery): string {
  const p = new URLSearchParams()
  if (query.q) p.set('q', query.q)
  if (query.location) p.set('location', query.location)
  if (query.department) p.set('department', query.department)
  if (query.status) p.set('status', query.status)
  p.set('page', String(query.page))
  p.set('pageSize', String(PAGE_SIZE))
  return p.toString()
}

export const hasFilters = (q: Pick<DirectoryQuery, 'q' | 'location' | 'department' | 'status'>) =>
  Boolean(q.q || q.location || q.department || q.status)

export const totalPages = (total: number, size: number) => Math.max(0, Math.ceil(total / size))

export const rangeOf = (page: number, size: number, total: number) => ({
  from: total === 0 ? 0 : (page - 1) * size + 1,
  to: Math.min(total, page * size),
})

// Up to `size` page numbers, centred on the current page
export function pageWindow(page: number, pages: number, size = 5): number[] {
  const half = Math.floor(size / 2)
  let start = Math.max(1, page - half)
  const end = Math.min(pages, start + size - 1)
  start = Math.max(1, end - size + 1)
  return Array.from({ length: Math.max(0, end - start + 1) }, (_, i) => start + i)
}