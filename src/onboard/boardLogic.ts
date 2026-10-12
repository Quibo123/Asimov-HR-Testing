import { OWNER_ROLES } from './logic'
import type { Blocker, BoardJoiner, BoardRow, BoardTask } from './boardTypes'
import type { OwnerRole } from './types'

// Whole days from one yyyy-MM-dd date to another
export function daysBetween(from: string, to: string): number {
  const ms = (d: string) => Date.parse(`${d}T00:00:00Z`)
  return Math.round((ms(to) - ms(from)) / 86_400_000)
}

// A task blocks the joiner when it is not done and its due date is today or earlier
export function blockersOf(tasks: BoardTask[], today: string): Blocker[] {
  const found: Blocker[] = []
  for (const t of tasks) {
    if (t.status === 'done') continue
    const late = daysBetween(t.dueDate, today)
    if (late < 0) continue
    found.push({ taskId: t.id, title: t.title, ownerRole: t.ownerRole, kind: late === 0 ? 'today' : 'overdue', days: late })
  }
  return found.sort((a, b) => b.days - a.days)
}

export function toRow(joiner: BoardJoiner, today: string): BoardRow {
  const total = joiner.tasks.length
  const done = joiner.tasks.filter(t => t.status === 'done').length
  return {
    joiner,
    done,
    total,
    percent: total === 0 ? 0 : Math.round((done / total) * 100),
    blockers: blockersOf(joiner.tasks, today),
    daysToJoin: daysBetween(today, joiner.joiningDate),
  }
}

// By joining date, soonest (or longest ago) first, then by name
export const buildRows = (joiners: BoardJoiner[], today: string): BoardRow[] =>
  joiners
    .map(j => toRow(j, today))
    .sort((a, b) => a.joiner.joiningDate.localeCompare(b.joiner.joiningDate) || a.joiner.name.localeCompare(b.joiner.name))

export type BoardFilter = { blockedOnly: boolean; owner: OwnerRole | '' }

export const filterRows = (rows: BoardRow[], f: BoardFilter): BoardRow[] =>
  rows.filter(r => {
    if (f.blockedOnly && r.blockers.length === 0) return false
    if (f.owner && !r.blockers.some(b => b.ownerRole === f.owner)) return false
    return true
  })

// Anything that is not a known role is ignored, so a hand-edited URL cannot break the page
export const parseOwner = (v: string | null): OwnerRole | '' => OWNER_ROLES.find(r => r === v) ?? ''

export function joinsLabel(daysToJoin: number): { key: string; count: number } {
  if (daysToJoin === 0) return { key: 'board.joinsToday', count: 0 }
  if (daysToJoin > 0) return { key: 'board.joinsIn', count: daysToJoin }
  return { key: 'board.joinedAgo', count: -daysToJoin }
}