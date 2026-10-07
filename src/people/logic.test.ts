import { describe, it, expect } from 'vitest'
import {
  PAGE_SIZE, hasFilters, pageWindow, parseEmployeeStatus, parsePage, rangeOf, toApiParams, totalPages,
} from './logic'

describe('URL values', () => {
  it('accepts only real pages', () => {
    expect(parsePage('3')).toBe(3)
    expect(parsePage(null)).toBe(1)
    expect(parsePage('0')).toBe(1)
    expect(parsePage('-2')).toBe(1)
    expect(parsePage('2.5')).toBe(1)
    expect(parsePage('abc')).toBe(1)
  })
  it('accepts only known statuses', () => {
    expect(parseEmployeeStatus('on_leave')).toBe('on_leave')
    expect(parseEmployeeStatus('hacked')).toBe('')
    expect(parseEmployeeStatus(null)).toBe('')
  })
})

describe('API params', () => {
  it('sends only what is set', () => {
    const p = new URLSearchParams(
      toApiParams({ q: 'pri', location: '', department: 'HR', status: '', page: 2 }),
    )
    expect(p.get('q')).toBe('pri')
    expect(p.get('department')).toBe('HR')
    expect(p.has('location')).toBe(false)
    expect(p.has('status')).toBe(false)
    expect(p.get('page')).toBe('2')
    expect(p.get('pageSize')).toBe(String(PAGE_SIZE))
  })
  it('encodes awkward text', () => {
    const p = new URLSearchParams(
      toApiParams({ q: 'a&b=c', location: '', department: '', status: '', page: 1 }),
    )
    expect(p.get('q')).toBe('a&b=c')
  })
  it('knows when a filter is active', () => {
    expect(hasFilters({ q: '', location: '', department: '', status: '' })).toBe(false)
    expect(hasFilters({ q: 'x', location: '', department: '', status: '' })).toBe(true)
  })
})

describe('pagination', () => {
  it('counts pages and the shown range', () => {
    expect(totalPages(0, 20)).toBe(0)
    expect(totalPages(20, 20)).toBe(1)
    expect(totalPages(21, 20)).toBe(2)
    expect(rangeOf(1, 20, 47)).toEqual({ from: 1, to: 20 })
    expect(rangeOf(3, 20, 47)).toEqual({ from: 41, to: 47 })
    expect(rangeOf(1, 20, 0)).toEqual({ from: 0, to: 0 })
  })
  it('keeps a window of page numbers around the current page', () => {
    expect(pageWindow(1, 10)).toEqual([1, 2, 3, 4, 5])
    expect(pageWindow(5, 10)).toEqual([3, 4, 5, 6, 7])
    expect(pageWindow(10, 10)).toEqual([6, 7, 8, 9, 10])
    expect(pageWindow(1, 2)).toEqual([1, 2])
    expect(pageWindow(1, 0)).toEqual([])
  })
})