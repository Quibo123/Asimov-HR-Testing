import { describe, it, expect } from 'vitest'
import onboard from '../i18n/en/onboard.json'
import {
  MAX_OFFSET, MIN_OFFSET, blankDraft, dueLabel, fromTemplate, newTask, parseOffset, toPayload,
  toggleItem, validateDraft,
} from './logic'
import type { Draft, OnboardTemplate, TaskDraft } from './types'

const task = (title: string, offset: string, over: Partial<TaskDraft> = {}): TaskDraft => ({
  ...newTask(), title, offset, ...over,
})

// The worked example from the playbook
const operator = (): Draft => ({
  name: 'Operator — Tiruppur',
  isDefault: false,
  departments: ['Production'],
  locations: ['Tiruppur'],
  tasks: [
    task('Collect the signed offer acceptance', '-7', { ownerRole: 'hr', requirement: 'document' }),
    task('Upload ID and bank proof', '-5', { ownerRole: 'employee', requirement: 'document' }),
    task('Prepare uniform and locker', '-2', { ownerRole: 'manager', requirement: 'acknowledgement' }),
    task('Safety induction', '0', { ownerRole: 'manager', requirement: 'acknowledgement' }),
    task('Sign the code of conduct', '1', { ownerRole: 'employee', requirement: 'acknowledgement' }),
  ],
})

describe('due offsets', () => {
  it('reads whole numbers in range', () => {
    expect(parseOffset('-7')).toBe(-7)
    expect(parseOffset('0')).toBe(0)
    expect(parseOffset('-0')).toBe(0)
    expect(Object.is(parseOffset('-0'), 0)).toBe(true)
    expect(parseOffset(' 12 ')).toBe(12)
    expect(parseOffset(String(MIN_OFFSET))).toBe(MIN_OFFSET)
    expect(parseOffset(String(MAX_OFFSET))).toBe(MAX_OFFSET)
  })
  it('rejects everything else', () => {
    for (const bad of ['', '-', 'abc', '1.5', '91', '-91', '3 days']) expect(parseOffset(bad)).toBeNull()
  })
  it('describes before, on and after', () => {
    expect(dueLabel(-7)).toEqual({ key: 'due.before', count: 7 })
    expect(dueLabel(0)).toEqual({ key: 'due.on', count: 0 })
    expect(dueLabel(3)).toEqual({ key: 'due.after', count: 3 })
  })
})

describe('validation', () => {
  it('accepts the Operator — Tiruppur example', () => {
    expect(validateDraft(operator())).toEqual([])
  })
  it('needs a name and at least one task', () => {
    const keys = validateDraft({ ...blankDraft(), isDefault: true }).map(i => i.key)
    expect(keys).toContain('issues.name')
    expect(keys).toContain('issues.noTasks')
  })
  it('needs a title and a valid day on every task', () => {
    const d = { ...operator(), tasks: [task('', '5'), task('Ok', 'x')] }
    const keys = validateDraft(d).map(i => i.key)
    expect(keys).toEqual(['issues.taskTitle', 'issues.taskOffset'])
  })
  it('a template that is not the default needs a match rule', () => {
    const d = { ...operator(), departments: [], locations: [] }
    expect(validateDraft(d).map(i => i.key)).toContain('issues.match')
    expect(validateDraft({ ...d, isDefault: true })).toEqual([])
    expect(validateDraft({ ...d, locations: ['Tiruppur'] })).toEqual([])
  })
})

describe('saving', () => {
  it('sends numbers and trimmed text', () => {
    const p = toPayload({ ...operator(), name: '  Operator — Tiruppur ' })
    expect(p.name).toBe('Operator — Tiruppur')
    expect(p.tasks.map(t => t.dueOffset)).toEqual([-7, -5, -2, 0, 1])
  })
  it('round-trips through a draft', () => {
    const t: OnboardTemplate = {
      id: 't9', name: 'X', isDefault: false, departments: ['A'], locations: [], runningCount: 2,
      tasks: [{ id: 'k1', title: 'Do it', ownerRole: 'it', dueOffset: -3, requirement: 'document' }],
    }
    expect(fromTemplate(t).tasks[0].offset).toBe('-3')
    expect(toPayload(fromTemplate(t)).tasks[0]).toEqual(t.tasks[0])
  })
  it('toggles list items', () => {
    expect(toggleItem(['a'], 'b')).toEqual(['a', 'b'])
    expect(toggleItem(['a', 'b'], 'a')).toEqual(['b'])
  })
})

describe('texts', () => {
  it('every issue has a text', () => {
    for (const k of ['name', 'noTasks', 'taskTitle', 'taskOffset', 'match'] as const) {
      expect(onboard.issues[k]).toBeTruthy()
    }
  })
})