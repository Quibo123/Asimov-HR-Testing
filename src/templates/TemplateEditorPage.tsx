import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { api } from '../lib/api'
import { ErrorState, SkeletonList } from '../components/states'
import type { Template } from './types'
import { blankTemplate } from './logic'
import TemplateBuilder from './TemplateBuilder'

// The result remembers which template it belongs to, so a stale answer is never shown
type Result = { id: string; status: 'ok'; template: Template } | { id: string; status: 'error' }

export default function TemplateEditorPage() {
  const { t } = useTranslation('templates')
  const { id } = useParams()
  const [result, setResult] = useState<Result | null>(null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (!id) return
    let cancelled = false
    api<Template>(`/talently/templates/${id}`)
      .then(template => { if (!cancelled) setResult({ id, status: 'ok', template }) })
      .catch(() => { if (!cancelled) setResult({ id, status: 'error' }) })
    return () => { cancelled = true }
  }, [id, attempt])

  if (!id) return <TemplateBuilder key="new" initial={blankTemplate()} />

  const current = result && result.id === id ? result : null
  if (!current) return <SkeletonList rows={4} height="h-20" />

  if (current.status === 'error') {
    return (
      <ErrorState
        message={t('editor.error')}
        onRetry={() => {
          setResult(null)
          setAttempt(a => a + 1)
        }}
      />
    )
  }

  return <TemplateBuilder key={id} initial={current.template} />
}