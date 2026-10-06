import { describe, it, expect } from 'vitest'
import ats from '../i18n/en/ats.json'
import type { Role } from '../lib/permissions'
import {
  DEFAULT_SORT, maskStatus, parseSort, parseStatus, pipelineButtons, serializeSort, sumOriginal,
  sumPoints, validateAdjustment, validateHire, validateNote, validateReason, visibleHistory,
  visibleStatuses,
} from './logic'
import type { BreakdownItem, CandidateStatus, HistoryEntry } from './types'

const item = (points: number, originalPoints: number): BreakdownItem => ({
  questionId: 'q', label: 'Q', answer: 'A', weight: 40, points, originalPoints,
  mustHave: false, mustHaveMet: true,
})

const cand = (status: CandidateStatus, verified = true) => ({
  status,
  verifiedAt: verified ? '2026-10-05T10:00:00Z' : null,
})
const names = (c: ReturnType<typeof cand>, role: Role) => pipelineButtons(c, role).map(b => b.action)

describe('no pipeline move before verification', () => {
  it('shows only a disabled Shortlist while unverified', () => {
    expect(pipelineButtons(cand('new', false), 'owner')).toEqual([{ action: 'shortlist', enabled: false }])
  })
  it('offers the next step plus reject once verified', () => {
    expect(names(cand('verified'), 'admin')).toEqual(['shortlist', 'reject'])
    expect(names(cand('shortlisted'), 'admin')).toEqual(['interview', 'reject'])
    expect(names(cand('interview'), 'admin')).toEqual(['offer', 'reject'])
    expect(names(cand('offer'), 'admin')).toEqual(['hire', 'reject'])
  })
  it('has no moves after hired or rejected', () => {
    expect(names(cand('hired'), 'admin')).toEqual([])
    expect(names(cand('rejected'), 'admin')).toEqual([])
  })
})

describe('interviewer cannot offer', () => {
  it('gets no pipeline buttons at any stage', () => {
    const all: CandidateStatus[] = ['new', 'verified', 'shortlisted', 'interview', 'offer', 'hired', 'rejected']
    for (const s of all) expect(names(cand(s), 'interviewer')).toEqual([])
    expect(pipelineButtons(cand('new', false), 'interviewer')).toEqual([])
  })
  it('never sees offer or hired', () => {
    expect(maskStatus('offer', 'interviewer')).toBe('interview')
    expect(maskStatus('hired', 'interviewer')).toBe('interview')
    expect(maskStatus('rejected', 'interviewer')).toBe('rejected')
    expect(maskStatus('offer', 'admin')).toBe('offer')
    expect(visibleStatuses('interviewer')).not.toContain('offer')
    expect(visibleStatuses('interviewer')).not.toContain('hired')
    expect(visibleStatuses('owner')).toContain('hired')
  })
  it('does not see offer steps in the history', () => {
    const h = (status: CandidateStatus): HistoryEntry => ({
      id: status, status, by: 'x', at: '2026-10-05T10:00:00Z',
    })
    const history = [h('new'), h('interview'), h('offer'), h('hired')]
    expect(visibleHistory(history, 'interviewer').map(e => e.status)).toEqual(['new', 'interview'])
    expect(visibleHistory(history, 'admin')).toHaveLength(4)
  })
})

describe('reasons, notes and hire details', () => {
  it('reject needs a reason', () => {
    expect(validateReason('   ')?.key).toBe('errors.reason')
    expect(validateReason('Not a fit')).toBeNull()
  })
  it('a note needs text', () => {
    expect(validateNote('')?.key).toBe('errors.note')
    expect(validateNote('Good answers')).toBeNull()
  })
  it('hire needs a date that is not in the past, and a location', () => {
    const today = '2026-10-07'
    expect(validateHire({ date: '', location: 'Chennai' }, today)?.key).toBe('errors.joiningDate')
    expect(validateHire({ date: '2026-10-06', location: 'Chennai' }, today)?.key).toBe('errors.joiningPast')
    expect(validateHire({ date: '2026-10-07', location: '  ' }, today)?.key).toBe('errors.location')
    expect(validateHire({ date: '2026-10-07', location: 'Chennai' }, today)).toBeNull()
  })
})

describe('adjustment', () => {
  it('needs a reason', () => {
    expect(validateAdjustment({ points: '20', reason: '   ' }, 40)?.field).toBe('reason')
    expect(validateAdjustment({ points: '20', reason: 'Checked CV' }, 40)).toBeNull()
  })
  it('keeps points inside 0 to the weight', () => {
    expect(validateAdjustment({ points: '-1', reason: 'x' }, 40)?.field).toBe('points')
    expect(validateAdjustment({ points: '41', reason: 'x' }, 40)?.field).toBe('points')
    expect(validateAdjustment({ points: 'abc', reason: 'x' }, 40)?.field).toBe('points')
  })
  it('recalculates the total and keeps the original', () => {
    const items = [item(20, 28), item(15, 15)]
    expect(sumPoints(items)).toBe(35)
    expect(sumOriginal(items)).toBe(43)
  })
})

describe('URL filters and sort', () => {
  it('parses and writes sort', () => {
    expect(parseSort('score:asc')).toEqual([{ id: 'score', desc: false }])
    expect(parseSort('nonsense')).toEqual(DEFAULT_SORT)
    expect(serializeSort([{ id: 'appliedAt', desc: true }])).toBe('appliedAt:desc')
  })
  it('accepts the new statuses and ignores unknown ones', () => {
    expect(parseStatus('interview')).toBe('interview')
    expect(parseStatus('hacked')).toBe('')
  })
})

describe('wording', () => {
  it('never labels a must-have failure as a rejection', () => {
    expect(ats.panel.flag.toLowerCase()).not.toContain('reject')
    expect(ats.table.flag.toLowerCase()).not.toContain('reject')
  })
})