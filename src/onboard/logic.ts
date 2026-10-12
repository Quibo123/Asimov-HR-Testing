import type { Draft, OnboardTemplate, OwnerRole, Requirement, TaskDraft } from './types'

export const OWNER_ROLES: OwnerRole[] = ['hr', 'manager', 'it', 'finance', 'employee']
export const REQUIREMENTS: Requirement[] = ['document', 'acknowledgement']
export const MIN_OFFSET = -90
export const MAX_OFFSET = 90

export const blankDraft = (): Draft => ({
  name: '', isDefault: false, departments: [], locations: [], tasks: [],
})

export const newTask = (): TaskDraft => ({
  id: crypto.randomUUID(), title: '', ownerRole: 'hr', offset: '0', requirement: 'document',
})

export const fromTemplate = (t: OnboardTemplate): Draft => ({
  name: t.name,
  isDefault: t.isDefault,
  departments: [...t.departments],
  locations: [...t.locations],
  tasks: t.tasks.map(k => ({
    id: k.id, title: k.title, ownerRole: k.ownerRole, offset: String(k.dueOffset), requirement: k.requirement,
  })),
})

// A whole number from -90 to 90, or null
export function parseOffset(text: string): number | null {
  const v = text.trim()
  if (!/^[-+]?\d+$/.test(v)) return null
  const n = Number(v)
  if (n < MIN_OFFSET || n > MAX_OFFSET) return null
  return n === 0 ? 0 : n // turns -0 into 0
}

export type Issue = { key: string; values?: Record<string, number> }

export function validateDraft(d: Draft): Issue[] {
  const issues: Issue[] = []
  if (!d.name.trim()) issues.push({ key: 'issues.name' })
  if (d.tasks.length === 0) issues.push({ key: 'issues.noTasks' })
  d.tasks.forEach((k, i) => {
    const n = i + 1
    if (!k.title.trim()) issues.push({ key: 'issues.taskTitle', values: { n } })
    if (parseOffset(k.offset) === null) {
      issues.push({ key: 'issues.taskOffset', values: { n, min: MIN_OFFSET, max: MAX_OFFSET } })
    }
  })
  if (!d.isDefault && d.departments.length === 0 && d.locations.length === 0) {
    issues.push({ key: 'issues.match' })
  }
  return issues
}

export const toPayload = (d: Draft) => ({
  name: d.name.trim(),
  isDefault: d.isDefault,
  departments: d.departments,
  locations: d.locations,
  tasks: d.tasks.map(k => ({
    id: k.id,
    title: k.title.trim(),
    ownerRole: k.ownerRole,
    dueOffset: parseOffset(k.offset) ?? 0,
    requirement: k.requirement,
  })),
})

export const toggleItem = (list: string[], item: string): string[] =>
  list.includes(item) ? list.filter(x => x !== item) : [...list, item]

export function dueLabel(offset: number): { key: string; count: number } {
  if (offset < 0) return { key: 'due.before', count: -offset }
  if (offset > 0) return { key: 'due.after', count: offset }
  return { key: 'due.on', count: 0 }
}