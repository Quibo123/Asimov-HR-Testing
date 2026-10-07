import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { getPublic, PublicApiError } from '../lib/publicApi'
import { ErrorState, SkeletonList } from '../components/states'
import type { JobFull } from './types'
import ApplyForm from './ApplyForm'

// The result remembers which job it belongs to, so a stale answer is never shown
type Result =
  | { id: string; status: 'ok'; job: JobFull }
  | { id: string; status: 'notfound' }
  | { id: string; status: 'error' }

const linkClass = 'inline-flex min-h-11 items-center underline'

export default function JobPage() {
  const { t } = useTranslation('careers')
  const { jobId = '' } = useParams()
  const [result, setResult] = useState<Result | null>(null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let cancelled = false
    getPublic<JobFull>(`/public/jobs/${jobId}`)
      .then(job => {
        if (!cancelled) setResult({ id: jobId, status: 'ok', job })
      })
      .catch(err => {
        if (cancelled) return
        const notFound = err instanceof PublicApiError && err.status === 404
        setResult({ id: jobId, status: notFound ? 'notfound' : 'error' })
      })
    return () => {
      cancelled = true
    }
  }, [jobId, attempt])

  const current = result && result.id === jobId ? result : null

  if (!current) return <SkeletonList rows={4} height="h-16" />

  if (current.status === 'ok') {
    const { job } = current

    return (
      <div className="flex flex-col gap-4">
        <Link to="/careers" className={`${linkClass} text-sm`}>{t('detail.back')}</Link>
        <h1 className="wrap-break-word text-2xl font-semibold">{job.title}</h1>
        <p className="text-sm opacity-80">{`${job.location} · ${job.type}`}</p>

        {job.status === 'closed' ? (
          <div role="alert" className="flex flex-col items-start gap-2 rounded-lg border p-4">
            <p className="font-medium">{t('detail.closed')}</p>
            <Link to="/careers" className={linkClass}>{t('detail.viewOpen')}</Link>
          </div>
        ) : (
          <>
            <p className="whitespace-pre-line wrap-break-word">{job.description}</p>
            <h2 className="text-xl font-semibold">{t('detail.apply')}</h2>
            <ApplyForm job={job} />
          </>
        )}
      </div>
    )
  }

  if (current.status === 'notfound') {
    return (
      <div className="flex flex-col items-start gap-2">
        <p role="alert">{t('detail.notFound')}</p>
        <Link to="/careers" className={linkClass}>{t('detail.viewOpen')}</Link>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <ErrorState
        message={t('detail.error')}
        onRetry={() => {
          setResult(null)
          setAttempt(a => a + 1)
        }}
      />
      <Link to="/careers" className={linkClass}>{t('detail.viewOpen')}</Link>
    </div>
  )
}