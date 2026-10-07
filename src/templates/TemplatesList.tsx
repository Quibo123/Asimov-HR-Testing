import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Button } from '@heroui/react'
import { api } from '../lib/api'
import { EmptyState, ErrorState, SkeletonList } from '../components/states'
import type { TemplateSummary } from './types'

type State = { status: 'loading' } | { status: 'error' } | { status: 'ok'; items: TemplateSummary[] }

export default function TemplatesList() {
  const { t } = useTranslation('templates')
  const navigate = useNavigate()
  const [state, setState] = useState<State>({ status: 'loading' })
  const [attempt, setAttempt] = useState(0)
  const [copyError, setCopyError] = useState(false)

  useEffect(() => {
    let cancelled = false
    api<TemplateSummary[]>('/talently/templates')
      .then(items => { if (!cancelled) setState({ status: 'ok', items }) })
      .catch(() => { if (!cancelled) setState({ status: 'error' }) })
    return () => { cancelled = true }
  }, [attempt])

  const retry = () => {
    setState({ status: 'loading' })
    setAttempt(a => a + 1)
  }

  async function handleCopy(id: string) {
    setCopyError(false)
    try {
      const created = await api<{ id: string }>(`/talently/templates/${id}/copy`, { method: 'POST' })
      navigate(`/talently/templates/${created.id}`)
    } catch {
      setCopyError(true)
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-semibold">{t('title')}</h1>
        <Button color="primary" className="min-h-11" onPress={() => navigate('/talently/templates/new')}>
          {t('list.new')}
        </Button>
      </div>

      {state.status === 'loading' && <SkeletonList rows={3} height="h-24" />}
      {state.status === 'error' && <ErrorState message={t('list.error')} onRetry={retry} />}
      {copyError && <p role="alert" className="text-red-600">{t('list.copyError')}</p>}

      {state.status === 'ok' && state.items.length === 0 && (
        <EmptyState message={t('list.empty')}>
          <Button color="primary" className="min-h-11" onPress={() => navigate('/talently/templates/new')}>
            {t('list.new')}
          </Button>
        </EmptyState>
      )}

      {state.status === 'ok' && state.items.map(item => (
        <div key={item.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-4">
          <div className="min-w-0">
            <h2 className="wrap-break-word font-semibold">{item.name}</h2>
            <p className="text-sm opacity-80">
              {`${t('list.version', { n: item.version })} · ${t('list.questions', { n: item.questionCount })}`}
            </p>
            {item.liveJobs > 0 && (
              <p className="text-sm font-medium">{t('list.liveJobs', { n: item.liveJobs })}</p>
            )}
          </div>
          <div className="flex items-center gap-3">
            <Link to={`/talently/templates/${item.id}`} className="inline-flex min-h-11 items-center underline">
              {t('list.edit')}
            </Link>
            <Button variant="bordered" className="min-h-11" onPress={() => handleCopy(item.id)}>
              {t('list.copy')}
            </Button>
          </div>
        </div>
      ))}
    </div>
  )
}