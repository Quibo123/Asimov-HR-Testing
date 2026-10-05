export type QType = 'text' | 'choice' | 'yesno' | 'number' | 'rating'

export type TemplateOption = { id: string; label: string; scorePercent: number }

// gte: number/rating answer, or a choice option's score. eq: yes/no answer.
export type MustHaveRule = { op: 'gte'; value: number } | { op: 'eq'; value: string }

export type TemplateQuestion = {
  id: string
  type: QType
  label: string
  required: boolean
  weight: number
  options: TemplateOption[] // choice and yesno only
  mustHave: boolean
  rule?: MustHaveRule
}

export type TemplateSummary = {
  id: string
  name: string
  version: number
  questionCount: number
  liveJobs: number
}

export type Template = {
  id?: string
  name: string
  version: number
  liveJobs: number
  questions: TemplateQuestion[]
}