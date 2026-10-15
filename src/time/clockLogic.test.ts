import { describe, it, expect } from 'vitest'
import time from '../i18n/en/time.json'
import {
  addPunch, classifyPunchError, makeKey, nextType, parsePending, startOrResume, stateOf,
} from './clockLogic'
import type { Pending, Punch } from './types'

const p = (id: string, type: Punch['type'], at: string): Punch => ({ id, type, at })

describe('clocked in or out', () => {
  it('is out with no punches, in after an "in", out after an "out"', () => {
    expect(stateOf([])).toBe('out')
    expect(stateOf([p('1', 'in', '2026-10-15T03:30:00Z')])).toBe('in')
    expect(stateOf([p('1', 'in', '2026-10-15T03:30:00Z'), p('2', 'out', '2026-10-15T12:30:00Z')])).toBe('out')
  })
  it('uses the latest punch, not the list order', () => {
    expect(stateOf([p('2', 'out', '2026-10-15T12:30:00Z'), p('1', 'in', '2026-10-15T03:30:00Z')])).toBe('out')
  })
  it('offers the opposite action', () => {
    expect(nextType('out')).toBe('in')
    expect(nextType('in')).toBe('out')
  })
})

describe('one tap, one key', () => {
  it('a retry gets the same key back', () => {
    const first = startOrResume(null, 'in', makeKey, '2026-10-15T03:30:00Z')
    const retry = startOrResume(first, 'in', makeKey, '2026-10-15T03:31:00Z')
    expect(retry).toBe(first)
    expect(retry.key).toBe(first.key)
    expect(retry.tappedAt).toBe('2026-10-15T03:30:00Z')
  })
  it('a new tap after the first was recorded gets a new key', () => {
    const a = startOrResume(null, 'in', makeKey, 'x')
    const b = startOrResume(null, 'out', makeKey, 'y')
    expect(b.key).not.toBe(a.key)
  })
  it('makes keys that are long and different', () => {
    const keys = new Set(Array.from({ length: 50 }, makeKey))
    expect(keys.size).toBe(50)
    for (const k of keys) expect(k.length).toBeGreaterThanOrEqual(32)
  })
})

describe('a replayed punch is listed once', () => {
  it('ignores a punch that is already there', () => {
    const list = [p('1', 'in', '2026-10-15T03:30:00Z')]
    expect(addPunch(list, p('1', 'in', '2026-10-15T03:30:00Z'))).toBe(list)
  })
  it('adds a new punch in time order', () => {
    const list = [p('2', 'out', '2026-10-15T12:30:00Z')]
    expect(addPunch(list, p('1', 'in', '2026-10-15T03:30:00Z')).map(x => x.id)).toEqual(['1', '2'])
  })
})

describe('what a failure means', () => {
  it('keeps the punch for a dropped network, a timeout, too many requests and server errors', () => {
    expect(classifyPunchError(new TypeError('network'))).toBe('retry')
    for (const status of [408, 429, 500, 502, 503]) expect(classifyPunchError({ status })).toBe('retry')
    expect(classifyPunchError(new Error('unknown'))).toBe('retry')
  })
  it('says so when the status already changed', () => {
    expect(classifyPunchError({ status: 409 })).toBe('conflict')
  })
  it('drops, with a message, what will not work if sent again', () => {
    for (const status of [400, 403, 404, 422]) expect(classifyPunchError({ status })).toBe('refused')
  })
})

describe('what is saved on the phone', () => {
  const ok: Pending = { key: 'k1', type: 'in', tappedAt: '2026-10-15T03:30:00Z' }
  it('reads a valid saved punch back', () => {
    expect(parsePending(JSON.stringify(ok))).toEqual(ok)
  })
  it('ignores empty, broken or odd data', () => {
    expect(parsePending(null)).toBeNull()
    expect(parsePending('not json')).toBeNull()
    expect(parsePending('{"key":"","type":"in","tappedAt":"x"}')).toBeNull()
    expect(parsePending('{"key":"k","type":"hack","tappedAt":"x"}')).toBeNull()
    expect(parsePending('42')).toBeNull()
  })
})

describe('texts', () => {
  it('has the messages the screen needs', () => {
    expect(time.clock.notSent).toBe('Not sent — tap to retry')
    for (const k of ['conflict', 'refused', 'pending', 'retryNote', 'offline', 'recorded'] as const) {
      expect(time.clock[k]).toBeTruthy()
    }
  })
})