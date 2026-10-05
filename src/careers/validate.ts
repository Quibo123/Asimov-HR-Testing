import type { Answer, Question } from './types'

export type AnswerError = { key: string; values?: Record<string, number> }

export const MAX_RESUME_BYTES = 10 * 1024 * 1024

const isEmpty = (v: Answer) => v === undefined || v === ''

export function validateAnswer(q: Question, v: Answer): AnswerError | null {
  if (isEmpty(v)) return q.required ? { key: 'errors.required' } : null

  switch (q.type) {
    case 'choice':
      return q.options.includes(String(v)) ? null : { key: 'errors.invalidChoice' }
    case 'yesno':
      return typeof v === 'boolean' ? null : { key: 'errors.required' }
    case 'number': {
      const n = Number(v)
      if (Number.isNaN(n)) return { key: 'errors.number' }
      if (q.min !== undefined && n < q.min) return { key: 'errors.min', values: { min: q.min } }
      if (q.max !== undefined && n > q.max) return { key: 'errors.max', values: { max: q.max } }
      return null
    }
    case 'rating': {
      const max = q.max ?? 5
      const n = Number(v)
      return Number.isInteger(n) && n >= 1 && n <= max
        ? null
        : { key: 'errors.rating', values: { max } }
    }
    case 'text':
      return q.maxLength !== undefined && String(v).length > q.maxLength
        ? { key: 'errors.tooLong', values: { max: q.maxLength } }
        : null
  }
}

export function validateResume(
  file: { name: string; size: number; type: string } | null,
): AnswerError | null {
  if (!file) return { key: 'errors.resumeRequired' }
  const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
  if (!isPdf) return { key: 'errors.resumeType' }
  if (file.size > MAX_RESUME_BYTES) return { key: 'errors.resumeSize' }
  return null
}

export function validateContact(f: {
  name: string
  email: string
  phone: string
}): Record<string, AnswerError> {
  const errors: Record<string, AnswerError> = {}
  if (!f.name.trim()) errors.name = { key: 'errors.required' }

  if (!f.email.trim()) errors.email = { key: 'errors.required' }
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.trim())) errors.email = { key: 'errors.email' }

  if (!f.phone.trim()) errors.phone = { key: 'errors.required' }
  else if (!/^[+()\d\s-]{7,20}$/.test(f.phone.trim())) errors.phone = { key: 'errors.phone' }

  return errors
}