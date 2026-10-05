type Base = { id: string; label: string; required: boolean }

export type Question =
  | (Base & { type: 'choice'; options: string[] })
  | (Base & { type: 'yesno' })
  | (Base & { type: 'number'; min?: number; max?: number })
  | (Base & { type: 'rating'; max?: number })
  | (Base & { type: 'text'; maxLength?: number })

export type Answer = string | number | boolean | undefined
export type Answers = Record<string, Answer>

export type Job = {
  id: string
  title: string
  location: string
  type: string
  status: 'open' | 'closed'
}

export type JobFull = Job & { description: string; questions: Question[] }