import { describe, it, expect } from 'vitest'
import ats from '../i18n/en/ats.json'
import {
  DEFAULT_SORT, canShortlist, parseSort, parseStatus, serializeSort, sumOriginal, sumPoints,
  validateAdjustment,
} from './logic'
import type { BreakdownItem } from './types'

const item = (points: number, originalPoints: number): BreakdownItem => ({
  questionId: 'q', label: 'Q', answer: 'A', weight: 40, points, originalPoints,
  mustHave: false, mustHaveMet: true,
})

describe('shortlist rule', () => {
  it('is blocked until verified', () => {
    expect(canShortlist({ verifiedAt: null, status: 'new' })).toBe(false)
    expect(canShortlist({ verifiedAt: '2026-10-05T10:00:00Z', status: 'verified' })).toBe(true)
    expect(canShortlist({ verifiedAt: '2026-10-05T10:00:00Z', status: 'shortlisted' })).toBe(false)
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
    expect(validateAdjustment({ points: '', reason: 'x' }, 40)?.field).toBe('points')
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
    expect(parseSort(null)).toEqual(DEFAULT_SORT)
    expect(serializeSort([{ id: 'appliedAt', desc: true }])).toBe('appliedAt:desc')
  })
  it('ignores unknown statuses', () => {
    expect(parseStatus('verified')).toBe('verified')
    expect(parseStatus('hacked')).toBe('')
  })
})

describe('wording', () => {
  it('never labels a must-have failure as a rejection', () => {
    expect(JSON.stringify(ats).toLowerCase()).not.toContain('reject')
  })
})