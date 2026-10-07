import { useRef, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Button, Checkbox, Input } from '@heroui/react'
import { postFormProgress } from '../lib/publicApi'
import type { Answer, Answers, JobFull } from './types'
import { validateAnswer, validateContact, validateResume, type AnswerError } from './validate'
import QuestionRenderer from './QuestionRenderer'
import ResumeDropzone from './ResumeDropzone'

type Errors = Record<string, AnswerError>

export default function ApplyForm({ job }: { job: JobFull }) {
  const { t } = useTranslation('careers')
  const navigate = useNavigate()
  const formRef = useRef<HTMLFormElement>(null)

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [answers, setAnswers] = useState<Answers>({})
  const [resume, setResume] = useState<File | null>(null)
  const [consent, setConsent] = useState(false)
  const [errors, setErrors] = useState<Errors>({})
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState(0)
  const [sendError, setSendError] = useState(false)

  const msg = (key: string) => (errors[key] ? t(errors[key].key, errors[key].values) : undefined)

  const clearError = (key: string) =>
    setErrors(prev => {
      const next = { ...prev }
      delete next[key]
      return next
    })

  const setAnswer = (id: string, value: Answer) => {
    setAnswers(prev => ({ ...prev, [id]: value }))
    clearError(`q:${id}`)
  }

  function validateAll(): Errors {
    const found: Errors = validateContact({ name, email, phone })
    for (const q of job.questions) {
      const err = validateAnswer(q, answers[q.id])
      if (err) found[`q:${q.id}`] = err
    }
    const resumeError = validateResume(resume)
    if (resumeError) found.resume = resumeError
    if (!consent) found.consent = { key: 'errors.consent' }
    return found
  }

  // After a failed submit, bring the first problem into view (above the keyboard)
  function focusFirstProblem() {
    requestAnimationFrame(() => {
      const el = formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"], [role="alert"]')
      el?.scrollIntoView({ block: 'center', behavior: 'smooth' })
      el?.focus()
    })
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSendError(false)

    const found = validateAll()
    setErrors(found)
    if (Object.keys(found).length > 0 || !resume) {
      focusFirstProblem()
      return
    }

    // Numbers were typed as text, so convert them before sending
    const cleaned: Record<string, string | number | boolean> = {}
    for (const q of job.questions) {
      const v = answers[q.id]
      if (v === undefined || v === '') continue
      cleaned[q.id] = q.type === 'number' ? Number(v) : v
    }

    const form = new FormData()
    form.append('name', name.trim())
    form.append('email', email.trim())
    form.append('phone', phone.trim())
    form.append('answers', JSON.stringify(cleaned))
    form.append('consent', 'true')
    form.append('resume', resume)

    setBusy(true)
    setProgress(0)
    try {
      await postFormProgress(`/public/jobs/${job.id}/applications`, form, setProgress)
      navigate(`/careers/${job.id}/success`)
    } catch {
      // Network drop or server error: keep every answer and offer a retry
      setSendError(true)
      setBusy(false)
    }
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
      <Input label={`${t('apply.name')} *`} value={name} autoComplete="name"
             onValueChange={v => { setName(v); clearError('name') }}
             isInvalid={!!errors.name} errorMessage={msg('name')} />
      <Input type="email" inputMode="email" autoComplete="email" label={`${t('apply.email')} *`} value={email}
             onValueChange={v => { setEmail(v); clearError('email') }}
             isInvalid={!!errors.email} errorMessage={msg('email')} />
      <Input type="tel" inputMode="tel" autoComplete="tel" label={`${t('apply.phone')} *`} value={phone}
             onValueChange={v => { setPhone(v); clearError('phone') }}
             isInvalid={!!errors.phone} errorMessage={msg('phone')} />

      {job.questions.length > 0 && (
        <h2 className="text-lg font-semibold">{t('apply.questions')}</h2>
      )}
      {job.questions.map(q => (
        <QuestionRenderer
          key={q.id}
          question={q}
          value={answers[q.id]}
          error={msg(`q:${q.id}`)}
          onChange={v => setAnswer(q.id, v)}
        />
      ))}

      <ResumeDropzone
        file={resume}
        error={msg('resume')}
        onSelect={f => { setResume(f); clearError('resume') }}
        onReject={err => setErrors(prev => ({ ...prev, resume: err }))}
      />

      <p className="text-sm opacity-80">{t('apply.privacy')}</p>
      <div>
        <Checkbox className="min-h-11" isSelected={consent}
                  onValueChange={v => { setConsent(v); clearError('consent') }}
                  isInvalid={!!errors.consent}>
          {t('apply.consent')}
        </Checkbox>
        {errors.consent && (
          <p role="alert" className="text-sm text-red-600">{msg('consent')}</p>
        )}
      </div>

      {busy && (
        <div
          role="progressbar"
          aria-label={t('apply.uploading')}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progress}
          className="flex flex-col gap-1"
        >
          <p className="text-sm">{t('apply.uploadingPercent', { n: progress })}</p>
          <div className="h-2 w-full overflow-hidden rounded bg-black/10">
            <div className="h-full bg-(--brand)" style={{ width: `${progress}%` }} />
          </div>
        </div>
      )}

      {sendError && (
        <div role="alert" className="flex flex-col gap-2 rounded-lg border border-red-300 p-3">
          <p className="text-red-600">{t('apply.sendError')}</p>
        </div>
      )}

      <Button type="submit" color="primary" className="min-h-12" isLoading={busy}>
        {sendError ? t('retry') : t('apply.submit')}
      </Button>
    </form>
  )
}