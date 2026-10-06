import type { SortingState } from '@tanstack/react-table'
import { can, type Permission, type Role } from '../lib/permissions'
import { formatInZone } from '../lib/time'
import type { BreakdownItem, CandidateStatus, HistoryEntry } from './types'

export const STATUSES: CandidateStatus[] = [
  'new', 'verified', 'shortlisted', 'interview', 'offer', 'hired', 'rejected',
]
// Stages only people with offer rights may see
const OFFER_STAGES: CandidateStatus[] = ['offer', 'hired']

export const DEFAULT_SORT: SortingState = [{ id: 'score', desc: true }]
const SORTABLE = ['score', 'appliedAt']

export const parseStatus = (v: string | null): CandidateStatus | '' =>
  STATUSES.find(s => s === v) ?? ''

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

export const localZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone

// Called when a form is submitted, never during render
export const todayString = () => formatInZone(new Date().toISOString(), localZone(), 'yyyy-MM-dd')

// ---- Interviewers never see Offer or Mark hired ----
const seesOffers = (role: Role | null | undefined) => can(role, 'pipeline.offer')

export const maskStatus = (status: CandidateStatus, role: Role | null | undefined): CandidateStatus =>
  !seesOffers(role) && OFFER_STAGES.includes(status) ? 'interview' : status

export const visibleStatuses = (role: Role | null | undefined) =>
  STATUSES.filter(s => seesOffers(role) || !OFFER_STAGES.includes(s))

export const visibleHistory = (history: HistoryEntry[], role: Role | null | undefined) =>
  seesOffers(role) ? history : history.filter(h => !OFFER_STAGES.includes(h.status))

// ---- Pipeline buttons ----
export type PipelineAction = 'shortlist' | 'interview' | 'offer' | 'hire' | 'reject'
export const PIPELINE_ACTIONS: PipelineAction[] = ['shortlist', 'interview', 'offer', 'hire', 'reject']

const FROM: Record<PipelineAction, CandidateStatus[]> = {
  shortlist: ['verified'],
  interview: ['shortlisted'],
  offer: ['interview'],
  hire: ['offer'],
  reject: ['verified', 'shortlisted', 'interview', 'offer'],
}

const PERMISSION: Record<PipelineAction, Permission> = {
  shortlist: 'pipeline.move',
  interview: 'pipeline.move',
  reject: 'pipeline.move',
  offer: 'pipeline.offer',
  hire: 'pipeline.offer',
}

export type PipelineButton = { action: PipelineAction; enabled: boolean }

// Nothing moves until the score is verified (the API also enforces this)
export function pipelineButtons(
  c: { status: CandidateStatus; verifiedAt: string | null },
  role: Role | null | undefined,
): PipelineButton[] {
  const allowed = PIPELINE_ACTIONS.filter(a => can(role, PERMISSION[a]))
  if (c.verifiedAt === null) {
    return allowed.includes('shortlist') ? [{ action: 'shortlist', enabled: false }] : []
  }
  return allowed.filter(a => FROM[a].includes(c.status)).map(action => ({ action, enabled: true }))
}

// ---- Validation ----
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

export type FormError = { field: 'reason' | 'date' | 'location' | 'note'; key: string }

export const validateReason = (text: string): FormError | null =>
  text.trim() ? null : { field: 'reason', key: 'errors.reason' }

export const validateNote = (text: string): FormError | null =>
  text.trim() ? null : { field: 'note', key: 'errors.note' }

// date is "yyyy-MM-dd", so plain string comparison is a correct date comparison
export function validateHire(input: { date: string; location: string }, today: string): FormError | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) return { field: 'date', key: 'errors.joiningDate' }
  if (input.date < today) return { field: 'date', key: 'errors.joiningPast' }
  if (!input.location.trim()) return { field: 'location', key: 'errors.location' }
  return null
}