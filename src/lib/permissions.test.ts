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
})