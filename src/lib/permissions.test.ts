import { describe, it, expect } from 'vitest'
import { can } from './permissions'

describe('can', () => {
  it('lets an owner remove users', () => {
    expect(can('owner', 'users.remove')).toBe(true)
  })
  it('stops a member from inviting', () => {
    expect(can('member', 'users.invite')).toBe(false)
  })
  it('denies when there is no role', () => {
    expect(can(null, 'users.view')).toBe(false)
  })
  it('lets an interviewer add notes but never offer or hire', () => {
    expect(can('interviewer', 'notes.add')).toBe(true)
    expect(can('interviewer', 'pipeline.offer')).toBe(false)
    expect(can('interviewer', 'pipeline.move')).toBe(false)
  })
  it('lets an admin offer and decide approvals', () => {
    expect(can('admin', 'pipeline.offer')).toBe(true)
    expect(can('admin', 'approvals.decide')).toBe(true)
  })
  it('gives HR the profile tabs and nobody else', () => {
    for (const p of ['people.documents', 'people.activity', 'people.sensitive'] as const) {
      expect(can('owner', p)).toBe(true)
      expect(can('admin', p)).toBe(true)
      expect(can('member', p)).toBe(false)
      expect(can('interviewer', p)).toBe(false)
      expect(can(undefined, p)).toBe(false)
    }
  })
  it('lets only HR import employees', () => {
    expect(can('owner', 'people.import')).toBe(true)
    expect(can('admin', 'people.import')).toBe(true)
    expect(can('member', 'people.import')).toBe(false)
    expect(can('interviewer', 'people.import')).toBe(false)
    expect(can(undefined, 'people.import')).toBe(false)
  })
})