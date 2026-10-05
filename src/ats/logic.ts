import type { SortingState } from '@tanstack/react-table'
import type { BreakdownItem, CandidateStatus } from './types'

export const STATUSES: CandidateStatus[] = ['new', 'verified', 'shortlisted']

export const DEFAULT_SORT: SortingState = [{ id: 'score', desc: true }]
const SORTABLE = ['score', 'appliedAt']

export const parseStatus = (v: string | null): CandidateStatus | '' =>
  STATUSES.find(s => s === v) ?? ''

// "score:desc" in the URL becomes TanStack's sorting state
export function parseSort(v: string | null): SortingState {
  if (v) {
    const [id, dir] = v.split(':')
    if (id !== undefined && SORTABLE.includes(id) && (dir === 'asc' || dir === 'desc')) {
      return [{ id, desc: dir === 'desc' }]
    }
  }
  return DEFAULT_SORT
}

export function serializeSort(s: SortingState): string {
  const first = s[0]
  return first ? `${first.id}:${first.desc ? 'desc' : 'asc'}` : ''
}

export const formatPoints = (n: number) => String(Math.round(n * 10) / 10)

export const sumPoints = (items: BreakdownItem[]) => items.reduce((s, i) => s + i.points, 0)
export const sumOriginal = (items: BreakdownItem[]) => items.reduce((s, i) => s + i.originalPoints, 0)

// Shortlist is only possible once the score is verified (the API also enforces this)
export const canShortlist = (c: { verifiedAt: string | null; status: string }) =>
  c.verifiedAt !== null && c.status !== 'shortlisted'

export type AdjustError = { field: 'points' | 'reason'; key: string; values?: { max: number } }

export function validateAdjustment(
  input: { points: string; reason: string },
  max: number,
): AdjustError | null {
  const raw = input.points.trim()
  const n = Number(raw)
  if (raw === '' || Number.isNaN(n) || n < 0 || n > max) {
    return { field: 'points', key: 'errors.points', values: { max } }
  }
  if (!input.reason.trim()) return { field: 'reason', key: 'errors.reason' }
  return null
}

export const localZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone