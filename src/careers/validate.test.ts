import { describe, it, expect } from 'vitest'
import { validateAnswer, validateContact, validateResume, MAX_RESUME_BYTES } from './validate'
import type { Question } from './types'

const base = { id: 'q', label: 'Q' }

describe('validateAnswer', () => {
  it('text: required and optional', () => {
    const req: Question = { ...base, type: 'text', required: true }
    const opt: Question = { ...base, type: 'text', required: false }
    expect(validateAnswer(req, '')).not.toBeNull()
    expect(validateAnswer(opt, '')).toBeNull()
  })
  it('text: max length', () => {
    const q: Question = { ...base, type: 'text', required: false, maxLength: 5 }
    expect(validateAnswer(q, 'abcdef')).not.toBeNull()
    expect(validateAnswer(q, 'abc')).toBeNull()
  })
  it('yesno: false is a valid answer', () => {
    const q: Question = { ...base, type: 'yesno', required: true }
    expect(validateAnswer(q, false)).toBeNull()
    expect(validateAnswer(q, undefined)).not.toBeNull()
  })
  it('number: min, max and not-a-number', () => {
    const q: Question = { ...base, type: 'number', required: true, min: 0, max: 10 }
    expect(validateAnswer(q, 'abc')).not.toBeNull()
    expect(validateAnswer(q, '-1')).not.toBeNull()
    expect(validateAnswer(q, '11')).not.toBeNull()
    expect(validateAnswer(q, '5')).toBeNull()
  })
  it('rating: 1 to max only', () => {
    const q: Question = { ...base, type: 'rating', required: true, max: 5 }
    expect(validateAnswer(q, 0)).not.toBeNull()
    expect(validateAnswer(q, 6)).not.toBeNull()
    expect(validateAnswer(q, 3)).toBeNull()
  })
  it('choice: must be one of the options', () => {
    const q: Question = { ...base, type: 'choice', required: true, options: ['A', 'B'] }
    expect(validateAnswer(q, 'C')).not.toBeNull()
    expect(validateAnswer(q, 'A')).toBeNull()
  })
})

describe('validateResume', () => {
  it('rejects missing, wrong type and too big', () => {
    expect(validateResume(null)).not.toBeNull()
    expect(validateResume({ name: 'a.txt', size: 10, type: 'text/plain' })).not.toBeNull()
    expect(validateResume({ name: 'a.pdf', size: MAX_RESUME_BYTES + 1, type: 'application/pdf' })).not.toBeNull()
  })
  it('accepts a normal PDF', () => {
    expect(validateResume({ name: 'cv.pdf', size: 1000, type: 'application/pdf' })).toBeNull()
  })
})

describe('validateContact', () => {
  it('flags empty and invalid values', () => {
    const e = validateContact({ name: '', email: 'nope', phone: '12' })
    expect(Object.keys(e)).toEqual(['name', 'email', 'phone'])
  })
  it('passes valid values', () => {
    expect(validateContact({ name: 'Asha', email: 'a@b.co', phone: '+91 98765 43210' })).toEqual({})
  })
})