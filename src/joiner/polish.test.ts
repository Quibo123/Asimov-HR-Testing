import { describe, it, expect } from 'vitest'
import joiner from '../i18n/en/joiner.json'
import { classifyFailure, resolveDark } from './logic'

describe('what a failed send means', () => {
  it('a dropped connection can be retried', () => {
    expect(classifyFailure(new TypeError('network'))).toBe('network')
  })
  it('an expired or unknown link is final', () => {
    expect(classifyFailure({ status: 410 })).toBe('gone')
    expect(classifyFailure({ status: 404 })).toBe('gone')
  })
  it('a refused file or step is not worth retrying as it is', () => {
    for (const s of [409, 413, 415, 422]) expect(classifyFailure({ status: s })).toBe('rejected')
  })
  it('a server error can be retried', () => {
    expect(classifyFailure({ status: 500 })).toBe('server')
    expect(classifyFailure(new Error('x'))).toBe('server')
    expect(classifyFailure(undefined)).toBe('server')
  })
})

describe('light and dark', () => {
  it('follows the phone setting', () => {
    expect(resolveDark('', true)).toBe(true)
    expect(resolveDark('', false)).toBe(false)
  })
  it('lets the link override it, for QA', () => {
    expect(resolveDark('?theme=dark', false)).toBe(true)
    expect(resolveDark('?theme=light', true)).toBe(false)
    expect(resolveDark('?theme=nonsense', true)).toBe(true)
  })
})

describe('texts', () => {
  it('has a message for every new situation', () => {
    expect(joiner.step.gone).toBeTruthy()
    expect(joiner.step.rejected).toBeTruthy()
    expect(joiner.empty.title).toBeTruthy()
    expect(joiner.empty.text).toBeTruthy()
  })
})