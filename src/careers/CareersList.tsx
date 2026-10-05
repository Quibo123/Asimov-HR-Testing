import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Button } from '@heroui/react'
import { getPublic } from '../lib/publicApi'
import type { Job } from './types'

type State = { status: 'loading' } | { status: 'error' } | { status: 'ok'; jobs: Job[] }

export default function CareersList() {
  const { t } = useTranslation('careers')
  const [state, setState] = useState<State>({ status: 'loading' })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let cancelled = false
    getPublic<Job[]>('/public/jobs')
      .then(jobs => { if (!cancelled) setState({ status: 'ok', jobs }) })
      .catch(() => { if (!cancelled) setState({ status: 'error' }) })
    return () => { cancelled = true }
  }, [attempt])

  const retry = () => {
    setState({ status: 'loading' })
    setAttempt(a => a + 1)
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">{t('list.title')}</h1>

      {state.status === 'loading' && <p>{t('list.loading')}</p>}

      {state.status === 'error' && (
        <div role="alert" className="flex flex-col items-start gap-2">
          <p>{t('list.error')}</p>
          <Button onPress={retry}>{t('retry')}</Button>
        </div>
      )}

      {state.status === 'ok' && state.jobs.length === 0 && <p>{t('list.empty')}</p>}

      {state.status === 'ok' && state.jobs.map(job => (
        <Link key={job.id} to={`/careers/${job.id}`}
              className="block rounded-lg border p-4 hover:border-(--brand)">
          <h2 className="text-lg font-semibold">{job.title}</h2>
          <p className="text-sm opacity-80">{`${job.location} · ${job.type}`}</p>
          {job.status === 'closed' && (
            <p className="text-sm font-medium">{t('list.closedBadge')}</p>
          )}
        </Link>
      ))}
    </div>
  )
}