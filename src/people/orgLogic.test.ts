import { describe, it, expect } from 'vitest'
import { buildOrg, idsWithChildren, type OrgNode } from './orgLogic'
import type { OrgPerson } from './types'

const p = (id: string, managerId: string | null, name = id): OrgPerson => ({
  id, code: 'C-' + id, name, designation: 'Role', department: 'Dept', managerId, status: 'active',
})
const count = (nodes: OrgNode[]): number => nodes.reduce((s, n) => s + 1 + count(n.children), 0)

describe('org chains', () => {
  it('builds the chain A > B > C with the right team sizes', () => {
    const tree = buildOrg([p('C', 'B'), p('A', null), p('B', 'A')])
    expect(tree).toHaveLength(1)
    expect(tree[0].person.id).toBe('A')
    expect(tree[0].children[0].person.id).toBe('B')
    expect(tree[0].children[0].children[0].person.id).toBe('C')
    expect(tree[0].total).toBe(2)
    expect(tree[0].children[0].total).toBe(1)
    expect(tree[0].children[0].children[0].total).toBe(0)
  })

  it('sorts people by name at every level', () => {
    const tree = buildOrg([p('boss', null), p('z', 'boss', 'Zed'), p('a', 'boss', 'Asha')])
    expect(tree[0].children.map(n => n.person.name)).toEqual(['Asha', 'Zed'])
  })

  it('keeps a person whose manager is unknown, at the top', () => {
    const tree = buildOrg([p('A', null), p('X', 'missing')])
    expect(tree.map(n => n.person.id).sort()).toEqual(['A', 'X'])
  })

  it('treats someone who manages themselves as top level', () => {
    expect(buildOrg([p('A', 'A')]).map(n => n.person.id)).toEqual(['A'])
  })

  it('shows each person once, and does not hang, when there is a reporting loop', () => {
    const tree = buildOrg([p('A', 'B'), p('B', 'A')])
    expect(count(tree)).toBe(2)
  })

  it('counts everyone exactly once in a bigger tree', () => {
    const people = [p('A', null), p('B', 'A'), p('C', 'A'), p('D', 'B'), p('E', 'D'), p('F', 'missing')]
    expect(count(buildOrg(people))).toBe(people.length)
  })

  it('lists the people who have a team', () => {
    const tree = buildOrg([p('A', null), p('B', 'A'), p('C', 'B')])
    expect(idsWithChildren(tree).sort()).toEqual(['A', 'B'])
  })
})