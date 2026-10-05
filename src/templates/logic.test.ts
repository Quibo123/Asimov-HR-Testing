import { describe, it, expect } from 'vitest'
import { newQuestion, toCandidateQuestions, validateTemplate, weightTotal, withType } from './logic'
import type { TemplateQuestion } from './types'

const q = (weight: number): TemplateQuestion => ({ ...newQuestion('text'), label: 'Q', weight })

describe('weights', () => {
  it('adds them up', () => {
    expect(weightTotal([q(40), q(45)])).toBe(85)
  })
  it('blocks save unless the total is exactly 100', () => {
    const hasWeightIssue = (a: number, b: number) =>
      validateTemplate('T', [q(a), q(b)]).some(i => i.key === 'issues.weights')
    expect(hasWeightIssue(40, 45)).toBe(true) // 85
    expect(hasWeightIssue(60, 50)).toBe(true) // 110
    expect(hasWeightIssue(40, 60)).toBe(false) // 100
    expect(validateTemplate('T', [q(40), q(60)])).toEqual([])
  })
})

describe('validateTemplate', () => {
  it('needs a name, a question text and two choice options', () => {
    const choice = { ...withType(q(100), 'choice'), label: '' }
    const keys = validateTemplate('', [choice]).map(i => i.key)
    expect(keys).toContain('issues.name')
    expect(keys).toContain('issues.label')
    expect(keys).toContain('issues.options')
  })
})

describe('toCandidateQuestions (preview)', () => {
  it('shows no weights, scores or must-haves', () => {
    const choice: TemplateQuestion = {
      ...withType(q(40), 'choice'),
      label: 'Years of experience',
      mustHave: true,
      rule: { op: 'gte', value: 70 },
      options: [
        { id: 'a', label: '5+ years', scorePercent: 100 },
        { id: 'b', label: '3-4 years', scorePercent: 70 },
      ],
    }
    const json = JSON.stringify(toCandidateQuestions([choice, q(60)]))
    expect(json).not.toContain('weight')
    expect(json).not.toContain('scorePercent')
    expect(json).not.toContain('mustHave')
    expect(json).not.toContain('rule')
    expect(json).toContain('5+ years')
  })
})