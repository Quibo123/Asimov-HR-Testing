import { describe, it, expect } from 'vitest'
import onboard from '../i18n/en/onboard.json'
import {
  blockersOf, buildRows, daysBetween, filterRows, joinsLabel, parseOwner, toRow,
} from './boardLogic'
import type { BoardJoiner, BoardTask } from './boardTypes'

const task = (id: string, dueDate: string, status: BoardTask['status'], ownerRole: BoardTask['ownerRole'] = 'hr'): BoardTask =>
  ({ id, title: id, ownerRole, dueDate, status })

const joiner = (id: string, name: string, joiningDate: string, tasks: BoardTask[]): BoardJoiner =>
  ({ id, name, department: 'D', location: 'L', joiningDate, templateName: 'T', tasks })

const today = '2026-10-12'

describe('dates', () => {
  it('counts whole days, also across months', () => {
    expect(daysBetween('2026-10-12', '2026-10-15')).toBe(3)
    expect(daysBetween('2026-10-15', '2026-10-12')).toBe(-3)
    expect(daysBetween('2026-10-31', '2026-11-02')).toBe(2)
    expect(daysBetween('2026-10-12', '2026-10-12')).toBe(0)
  })
})

describe('blockers', () => {
  it('lists undone tasks that are due today or earlier, worst first', () => {
    const tasks = [
      task('future', '2026-10-13', 'todo'),
      task('today', '2026-10-12', 'todo'),
      task('late', '2026-10-07', 'todo', 'it'),
      task('doneLate', '2026-10-01', 'done'),
    ]
    const b = blockersOf(tasks, today)
    expect(b.map(x => x.taskId)).toEqual(['late', 'today'])
    expect(b[0]).toMatchObject({ kind: 'overdue', days: 5, ownerRole: 'it' })
    expect(b[1]).toMatchObject({ kind: 'today', days: 0 })
  })
  it('has no blockers when everything is done or in the future', () => {
    expect(blockersOf([task('a', '2026-10-01', 'done'), task('b', '2026-12-01', 'todo')], today)).toEqual([])
  })
})

describe('rows', () => {
  it('works out progress', () => {
    const r = toRow(joiner('1', 'A', '2026-10-20', [task('a', '2026-10-01', 'done'), task('b', '2026-12-01', 'todo')]), today)
    expect(r).toMatchObject({ done: 1, total: 2, percent: 50, daysToJoin: 8 })
    expect(toRow(joiner('2', 'B', today, []), today).percent).toBe(0)
  })
  it('sorts by joining date, then name', () => {
    const rows = buildRows(
      [joiner('1', 'Zed', '2026-10-20', []), joiner('2', 'Asha', '2026-10-20', []), joiner('3', 'Mid', '2026-10-10', [])],
      today,
    )
    expect(rows.map(r => r.joiner.name)).toEqual(['Mid', 'Asha', 'Zed'])
  })
  it('filters to blocked joiners and to who they wait on', () => {
    const rows = buildRows(
      [
        joiner('1', 'A', '2026-10-20', [task('x', '2026-10-01', 'todo', 'it')]),
        joiner('2', 'B', '2026-10-20', [task('y', '2026-10-01', 'todo', 'hr')]),
        joiner('3', 'C', '2026-10-20', [task('z', '2026-12-01', 'todo', 'hr')]),
      ],
      today,
    )
    expect(filterRows(rows, { blockedOnly: false, owner: '' })).toHaveLength(3)
    expect(filterRows(rows, { blockedOnly: true, owner: '' })).toHaveLength(2)
    expect(filterRows(rows, { blockedOnly: false, owner: 'it' }).map(r => r.joiner.name)).toEqual(['A'])
  })
})

describe('labels and URL values', () => {
  it('describes when someone joins', () => {
    expect(joinsLabel(0)).toEqual({ key: 'board.joinsToday', count: 0 })
    expect(joinsLabel(4)).toEqual({ key: 'board.joinsIn', count: 4 })
    expect(joinsLabel(-2)).toEqual({ key: 'board.joinedAgo', count: 2 })
  })
  it('accepts only known owner roles', () => {
    expect(parseOwner('it')).toBe('it')
    expect(parseOwner('hacked')).toBe('')
    expect(parseOwner(null)).toBe('')
  })
  it('every owner role has a readable name', () => {
    for (const r of ['hr', 'manager', 'it', 'finance', 'employee'] as const) expect(onboard.roles[r]).toBeTruthy()
  })
})