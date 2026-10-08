import type { OrgPerson } from './types'

export type OrgNode = {
  person: OrgPerson
  children: OrgNode[]
  total: number // everyone below this person, not only direct reports
}

const byName = (a: OrgPerson, b: OrgPerson) => a.name.localeCompare(b.name) || a.code.localeCompare(b.code)

export function buildOrg(people: OrgPerson[]): OrgNode[] {
  const ids = new Set(people.map(p => p.id))
  const reports = new Map<string, OrgPerson[]>()
  const top: OrgPerson[] = []

  for (const p of people) {
    // No manager, a manager we don't know, or "manages themselves": top of a chain
    if (p.managerId && p.managerId !== p.id && ids.has(p.managerId)) {
      const list = reports.get(p.managerId) ?? []
      list.push(p)
      reports.set(p.managerId, list)
    } else {
      top.push(p)
    }
  }

  const seen = new Set<string>()
  const make = (p: OrgPerson): OrgNode => {
    seen.add(p.id)
    const children = (reports.get(p.id) ?? []).filter(c => !seen.has(c.id)).sort(byName).map(make)
    return { person: p, children, total: children.reduce((sum, c) => sum + 1 + c.total, 0) }
  }

  const tree = top.sort(byName).map(make)
  // People in a reporting loop have no way up to the top. Show each one once so nobody is lost.
  for (const p of [...people].sort(byName)) {
    if (!seen.has(p.id)) tree.push(make(p))
  }
  return tree
}

export function idsWithChildren(nodes: OrgNode[]): string[] {
  return nodes.flatMap(n => (n.children.length > 0 ? [n.person.id, ...idsWithChildren(n.children)] : []))
}