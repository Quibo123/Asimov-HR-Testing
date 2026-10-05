import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { getPublic, PublicApiError } from '../lib/publicApi'
import type { JobFull } from './types'
import ApplyForm from './ApplyForm'

// The result remembers which job it belongs to, so a stale answer is never shown
type Result =
  | { id: string; status: 'ok'; job: JobFull }
  | { id: string; status: 'notfound' | 'error' }

export default function JobPage() {
  const { t } = useTranslation('careers')
  const { jobId = '' } = useParams()
  const [result, setResult] = useState<Result | null>(null)

  useEffect(() => {
    let cancelled = false
    getPublic<JobFull>(`/public/jobs/${jobId}`)
      .then(job => { if (!cancelled) setResult({ id: jobId, status: 'ok', job }) })
      .catch(err => {
        if (cancelled) return
        const notFound = err instanceof PublicApiError && err.status === 404
        setResult({ id: jobId, status: notFound ? 'notfound' : 'error' })
      })
    return () => { cancelled = true }
  }, [jobId])

  const current = result && result.id === jobId ? result : null

  if (!current) return <p>{t('detail.loading')}</p>

  if (current.status !== 'ok') {
    return (
      <div className="flex flex-col items-start gap-2">
        <p role="alert">
          {current.status === 'notfound' ? t('detail.notFound') : t('detail.error')}
        </p>
        <Link to="/careers" className="underline">{t('detail.viewOpen')}</Link>
      </div>
    )
  }

  const { job } = current

  return (
    <div className="flex flex-col gap-4">
      <Link to="/careers" className="text-sm underline">{t('detail.back')}</Link>
      <h1 className="text-2xl font-semibold">{job.title}</h1>
      <p className="text-sm opacity-80">{`${job.location} · ${job.type}`}</p>

      {job.status === 'closed' ? (
        <div role="alert" className="flex flex-col items-start gap-2 rounded-lg border p-4">
          <p className="font-medium">{t('detail.closed')}</p>
          <Link to="/careers" className="underline">{t('detail.viewOpen')}</Link>
        </div>
      ) : (
        <>
          <p className="whitespace-pre-line">{job.description}</p>
          <h2 className="text-xl font-semibold">{t('detail.apply')}</h2>
          <ApplyForm job={job} />
        </>
      )}
    </div>
  )
}