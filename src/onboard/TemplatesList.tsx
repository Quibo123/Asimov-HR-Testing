import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Button } from '@heroui/react'
import { EmptyState, ErrorState, SkeletonList } from '../components/states'
import { can } from '../lib/permissions'
import { useAuth } from '../auth/authContext'
import { useOnboardTemplates } from './queries'

export default function TemplatesList() {
  const { t } = useTranslation('onboard')
  const navigate = useNavigate()
  const { me } = useAuth()
  const { data, isPending, isError, refetch } = useOnboardTemplates()

  // After all hooks. Other roles never see this page, and the API answers 403 too.
  if (!can(me?.role, 'onboard.templates')) return <Navigate to="/" replace />

  const create = () => navigate('/onboard/templates/new')

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-semibold">{t('list.title')}</h1>
        <Button color="primary" className="min-h-11" onPress={create}>{t('list.new')}</Button>
      </div>

      {isPending && <SkeletonList rows={3} height="h-24" />}
      {isError && <ErrorState message={t('list.error')} onRetry={() => void refetch()} />}

      {data && data.length === 0 && (
        <EmptyState message={t('list.empty')}>
          <Button color="primary" className="min-h-11" onPress={create}>{t('list.new')}</Button>
        </EmptyState>
      )}

      {data?.map(s => {
        const noRules = s.departments.length === 0 && s.locations.length === 0
        return (
          <div key={s.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="min-w-0 font-semibold wrap-break-word">{s.name}</h2>
                {s.isDefault && (
                  <span className="rounded border border-(--brand) px-2 py-0.5 text-xs font-medium">
                    {t('list.default')}
                  </span>
                )}
              </div>
              <p className="text-sm opacity-80">
                {`${t('list.tasks', { count: s.taskCount })} · ${t('list.running', { count: s.runningCount })}`}
              </p>
              {noRules && <p className="text-sm">{t('list.fallback')}</p>}
              {s.departments.length > 0 && (
                <p className="text-sm wrap-break-word">{t('list.departments', { list: s.departments.join(', ') })}</p>
              )}
              {s.locations.length > 0 && (
                <p className="text-sm wrap-break-word">{t('list.locations', { list: s.locations.join(', ') })}</p>
              )}
            </div>
            <Link to={`/onboard/templates/${s.id}`} className="inline-flex min-h-11 items-center underline">
              {t('list.edit')}
            </Link>
          </div>
        )
      })}
    </div>
  )
}