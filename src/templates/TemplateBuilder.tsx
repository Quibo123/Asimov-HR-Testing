import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Button, Input } from '@heroui/react'
import { api } from '../lib/api'
import type { Template, TemplateQuestion } from './types'
import { WEIGHT_TOTAL, newQuestion, validateTemplate, weightTotal } from './logic'
import QuestionEditor from './QuestionEditor'
import PreviewPanel from './PreviewPanel'

export default function TemplateBuilder({ initial }: { initial: Template }) {
  const { t } = useTranslation('templates')
  const navigate = useNavigate()

  const [name, setName] = useState(initial.name)
  const [questions, setQuestions] = useState<TemplateQuestion[]>(initial.questions)
  const [showPreview, setShowPreview] = useState(false)
  const [busy, setBusy] = useState(false)
  const [saveError, setSaveError] = useState(false)

  const total = weightTotal(questions)
  const issues = validateTemplate(name, questions)
  const isLive = initial.id !== undefined && initial.liveJobs > 0
  const nextVersion = initial.version + 1

  const updateQuestion = (id: string, q: TemplateQuestion) =>
    setQuestions(prev => prev.map(x => (x.id === id ? q : x)))
  const removeQuestion = (id: string) => setQuestions(prev => prev.filter(x => x.id !== id))
  const moveQuestion = (index: number, dir: -1 | 1) =>
    setQuestions(prev => {
      const to = index + dir
      if (to < 0 || to >= prev.length) return prev
      const next = [...prev]
      ;[next[index], next[to]] = [next[to], next[index]]
      return next
    })

  async function handleSave() {
    if (issues.length > 0) return
    // Editing a template that live jobs use makes a new version
    if (isLive && !window.confirm(t('editor.versionWarning', { n: nextVersion }))) return

    setBusy(true)
    setSaveError(false)
    const body = JSON.stringify({ name: name.trim(), questions })
    try {
      if (initial.id) await api(`/talently/templates/${initial.id}`, { method: 'PUT', body })
      else await api('/talently/templates', { method: 'POST', body })
      navigate('/talently/templates')
    } catch {
      setSaveError(true)
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
      <Link to="/talently/templates" className="text-sm underline">{t('editor.back')}</Link>
      <h1 className="text-xl font-semibold">
        {initial.id ? t('editor.editTitle') : t('editor.newTitle')}
      </h1>

      {isLive && (
        <p role="note" className="rounded-lg border-2 border-(--brand) p-3">
          {t('editor.versionWarning', { n: nextVersion })}
        </p>
      )}

      <Input label={t('editor.name')} value={name} onValueChange={setName} isRequired />

      {questions.map((q, i) => (
        <QuestionEditor
          key={q.id}
          q={q}
          index={i}
          count={questions.length}
          onChange={next => updateQuestion(q.id, next)}
          onRemove={() => removeQuestion(q.id)}
          onMove={dir => moveQuestion(i, dir)}
        />
      ))}

      <Button variant="bordered" className="self-start" onPress={() => setQuestions(p => [...p, newQuestion()])}>
        {t('editor.addQuestion')}
      </Button>

      <div className="sticky bottom-0 flex flex-wrap items-center gap-3 border-t bg-(--surface) py-3">
        <p
          role="status"
          className={`font-semibold ${total === WEIGHT_TOTAL ? 'text-green-700' : 'text-amber-700'}`}
        >
          {t('weights', { total, max: WEIGHT_TOTAL })}
        </p>
        <Button color="primary" isDisabled={issues.length > 0 || busy} isLoading={busy} onPress={handleSave}>
          {t('editor.save')}
        </Button>
        <Button variant="flat" onPress={() => setShowPreview(s => !s)}>
          {showPreview ? t('editor.hidePreview') : t('editor.preview')}
        </Button>
      </div>

      <p className="text-sm opacity-80">{t('weightsHint', { max: WEIGHT_TOTAL })}</p>

      {issues.length > 0 && (
        <ul className="list-disc pl-5 text-sm">
          {issues.map((issue, idx) => (
            <li key={idx}>{t(issue.key, issue.values)}</li>
          ))}
        </ul>
      )}

      {saveError && <p role="alert" className="text-red-600">{t('editor.saveError')}</p>}

      {showPreview && <PreviewPanel questions={questions} />}
    </div>
  )
}