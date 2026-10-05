import type { Question } from '../careers/types'
import type { MustHaveRule, QType, Template, TemplateOption, TemplateQuestion } from './types'

export const WEIGHT_TOTAL = 100

export type TemplateIssue = { key: string; values?: Record<string, string | number> }

export const newId = () => crypto.randomUUID()

export const newOption = (): TemplateOption => ({ id: newId(), label: '', scorePercent: 0 })

export function clampInt(v: string, min: number, max: number): number {
  const n = Number.parseInt(v, 10)
  if (Number.isNaN(n)) return min
  return Math.min(max, Math.max(min, n))
}

export const blankTemplate = (): Template => ({ name: '', version: 1, liveJobs: 0, questions: [] })

// Changing the type resets options and the must-have rule, but keeps text and weight
export function withType(q: TemplateQuestion, type: QType): TemplateQuestion {
  const options: TemplateOption[] =
    type === 'yesno'
      ? [
          { id: 'yes', label: 'Yes', scorePercent: 100 },
          { id: 'no', label: 'No', scorePercent: 0 },
        ]
      : type === 'choice'
        ? [newOption(), newOption()]
        : []
  return { ...q, type, options, mustHave: false, rule: undefined }
}

export function newQuestion(type: QType = 'text'): TemplateQuestion {
  return withType(
    { id: newId(), type, label: '', required: true, weight: 0, options: [], mustHave: false },
    type,
  )
}

export function defaultRule(q: TemplateQuestion): MustHaveRule | undefined {
  switch (q.type) {
    case 'choice': return { op: 'gte', value: 70 }
    case 'number': return { op: 'gte', value: 1 }
    case 'rating': return { op: 'gte', value: 3 }
    case 'yesno': return { op: 'eq', value: 'yes' }
    default: return undefined
  }
}

export const weightTotal = (qs: TemplateQuestion[]) =>
  qs.reduce((sum, q) => sum + (Number.isFinite(q.weight) ? q.weight : 0), 0)

export function validateTemplate(name: string, questions: TemplateQuestion[]): TemplateIssue[] {
  const issues: TemplateIssue[] = []
  if (!name.trim()) issues.push({ key: 'issues.name' })
  if (questions.length === 0) issues.push({ key: 'issues.noQuestions' })

  const total = weightTotal(questions)
  if (total !== WEIGHT_TOTAL) {
    issues.push({ key: 'issues.weights', values: { total, max: WEIGHT_TOTAL } })
  }

  questions.forEach((q, i) => {
    const n = i + 1
    if (!q.label.trim()) issues.push({ key: 'issues.label', values: { n } })
    if (q.type === 'choice' && (q.options.length < 2 || q.options.some(o => !o.label.trim()))) {
      issues.push({ key: 'issues.options', values: { n } })
    }
  })
  return issues
}

// Candidates get ONLY what they need to answer: no weights, scores or must-haves
export function toCandidateQuestions(qs: TemplateQuestion[]): Question[] {
  return qs.map((q): Question => {
    const base = { id: q.id, label: q.label, required: q.required }
    switch (q.type) {
      case 'choice': return { ...base, type: 'choice', options: q.options.map(o => o.label) }
      case 'yesno': return { ...base, type: 'yesno' }
      case 'number': return { ...base, type: 'number' }
      case 'rating': return { ...base, type: 'rating' }
      default: return { ...base, type: 'text' }
    }
  })
}