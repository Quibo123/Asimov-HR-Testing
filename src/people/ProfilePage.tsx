import { Link, useLocation, useParams, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Tab, Tabs } from '@heroui/react'
import { ErrorState, SkeletonList } from '../components/states'
import { ApiError } from '../lib/api'
import { useAuth } from '../auth/authContext'
import { useProfile } from './profileQueries'
import { isExited, resolveTab, visibleTabs } from './profileLogic'
import { ActivityTab, JobTab, OverviewTab, SensitiveTab } from './ProfileSections'
import DocumentsTab from './DocumentsTab'

const linkClass = 'inline-flex min-h-11 items-center text-sm underline'

export default function ProfilePage() {
  const { t } = useTranslation('people')
  const { id = '' } = useParams()
  const { me } = useAuth()
  const role = me?.role
  const [params, setParams] = useSearchParams()
  const location = useLocation()
  const { data: e, isPending, isError, error, refetch } = useProfile(id)

  // The directory sends its search and page along, so Back returns to the same list
  const from = (location.state as { from?: string } | null)?.from ?? ''
  const backTo = `/people/directory${from}`

  const tabs = visibleTabs(role)
  const tab = resolveTab(params.get('tab'), role)

  function selectTab(key: string) {
    setParams(
      prev => {
        const next = new URLSearchParams(prev)
        if (key === 'overview') next.delete('tab')
        else next.set('tab', key)
        return next
      },
      { replace: true, state: location.state },
    )
  }

  const back = <Link to={backTo} className={linkClass}>{t('profile.back')}</Link>

  if (isPending) {
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
        {back}
        <SkeletonList rows={4} height="h-16" />
      </div>
    )
  }

  if (isError) {
    const notFound = error instanceof ApiError && error.status === 404
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
        {back}
        {notFound ? (
          <p role="alert">{t('profile.notFound')}</p>
        ) : (
          <ErrorState message={t('profile.error')} onRetry={() => void refetch()} />
        )}
      </div>
    )
  }

  const exited = isExited(e.status)

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
      {back}

      <div className="flex flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="min-w-0 text-xl font-semibold wrap-break-word">{e.name}</h1>
          {exited && (
            <span className="rounded border border-red-400 bg-red-100 px-2 py-0.5 text-sm font-medium text-red-900">
              {t('profile.exitedBadge')}
            </span>
          )}
        </div>
        <p className="wrap-break-word">{e.designation}</p>
        <p className="text-sm opacity-80">{`${e.location} · ${e.department}`}</p>
      </div>

      {exited && <p role="note" className="rounded-lg border p-3">{t('profile.readOnly')}</p>}

      <div className="min-w-0">
        <Tabs
          aria-label={t('profile.tabsLabel')}
          selectedKey={tab}
          onSelectionChange={key => selectTab(String(key))}
          classNames={{ tab: 'h-11' }}
        >
          {tabs.map(k => (
            <Tab key={k} title={t(`profile.tabs.${k}`)} />
          ))}
        </Tabs>
      </div>

      <section aria-label={t(`profile.tabs.${tab}`)} className="min-w-0">
        {tab === 'overview' && <OverviewTab e={e} />}
        {tab === 'job' && <JobTab e={e} />}
        {tab === 'documents' && <DocumentsTab key={e.id} employeeId={e.id} readOnly={exited} />}
        {tab === 'activity' && <ActivityTab employeeId={e.id} />}
        {tab === 'sensitive' && <SensitiveTab employeeId={e.id} />}
      </section>
    </div>
  )
}