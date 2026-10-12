import { useMemo } from 'react'
import { Navigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Button, Checkbox } from '@heroui/react'
import { EmptyState, ErrorState, SkeletonList } from '../components/states'
import { dayLabel } from '../lib/dayLabel'
import { can } from '../lib/permissions'
import { useAuth } from '../auth/authContext'
import { OWNER_ROLES } from './logic'
import { buildRows, filterRows, joinsLabel, parseOwner } from './boardLogic'
import { useBoard } from './boardQueries'

const chip = 'rounded border px-2 py-0.5 text-xs font-medium'

export default function BoardPage() {
  const { t } = useTranslation('onboard')
  const { me } = useAuth()
  const [params, setParams] = useSearchParams()
  const { data, isPending, isError, refetch } = useBoard()
  const rows = useMemo(() => (data ? buildRows(data.joiners, data.asOf) : []), [data])

  // After all hooks. Other roles never see this page, and the API answers 403 too.
  if (!can(me?.role, 'onboard.board')) return <Navigate to="/" replace />

  // Filters live in the URL, so a refresh keeps them
  const blockedOnly = params.get('blocked') === '1'
  const owner = parseOwner(params.get('owner'))
  const shown = filterRows(rows, { blockedOnly, owner })
  const blockedCount = rows.filter(r => r.blockers.length > 0).length

  function setParam(key: string, value: string) {
    setParams(
      prev => {
        const next = new URLSearchParams(prev)
        if (value) next.set(key, value)
        else next.delete(key)
        return next
      },
      { replace: true },
    )
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
      <h1 className="text-xl font-semibold">{t('board.title')}</h1>
      <p className="text-sm opacity-80">{t('board.intro')}</p>

      {isPending && <SkeletonList rows={4} height="h-40" />}
      {isError && <ErrorState message={t('board.error')} onRetry={() => void refetch()} />}
      {data && rows.length === 0 && <EmptyState message={t('board.empty')} />}

      {rows.length > 0 && (
        <>
          <p role="status" className="font-medium">
            {t('board.summary', { count: rows.length, blocked: blockedCount })}
          </p>

          <div className="flex flex-wrap items-end gap-3">
            <Checkbox
              className="min-h-11"
              isSelected={blockedOnly}
              onValueChange={v => setParam('blocked', v ? '1' : '')}
            >
              {t('board.blockedOnly')}
            </Checkbox>

            <label className="flex flex-col gap-1 text-sm">
              {t('board.owner')}
              <select
                className="h-11 rounded-lg border bg-transparent px-2"
                value={owner}
                onChange={e => setParam('owner', e.target.value)}
              >
                <option value="">{t('board.anyOwner')}</option>
                {OWNER_ROLES.map(r => (
                  <option key={r} value={r}>{t(`roles.${r}`)}</option>
                ))}
              </select>
            </label>

            {(blockedOnly || owner) && (
              <Button variant="flat" className="min-h-11" onPress={() => setParams({}, { replace: true })}>
                {t('board.clear')}
              </Button>
            )}
          </div>

          {shown.length === 0 && (
            <EmptyState message={t('board.noMatch')}>
              <Button variant="flat" className="min-h-11" onPress={() => setParams({}, { replace: true })}>
                {t('board.clear')}
              </Button>
            </EmptyState>
          )}

          <ul className="flex flex-col gap-3">
            {shown.map(r => {
              const { joiner: j } = r
              const label = joinsLabel(r.daysToJoin)
              const complete = r.total > 0 && r.done === r.total
              return (
                <li key={j.id} className="flex flex-col gap-3 rounded-lg border p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="min-w-0 font-semibold wrap-break-word">{j.name}</h2>
                    {r.blockers.length > 0 && (
                      <span className={`${chip} border-amber-500 bg-amber-100 text-amber-900`}>{t('board.blocked')}</span>
                    )}
                    {complete && (
                      <span className={`${chip} border-green-600 bg-green-100 text-green-900`}>{t('board.complete')}</span>
                    )}
                  </div>

                  <div className="text-sm">
                    <p>{`${t('board.joiningOn', { date: dayLabel(j.joiningDate) })} · ${t(label.key, { count: label.count })}`}</p>
                    <p className="opacity-80 wrap-break-word">
                      {t('board.meta', { department: j.department, location: j.location })}
                    </p>
                    <p className="opacity-70 wrap-break-word">{t('board.template', { name: j.templateName })}</p>
                  </div>

                  <div
                    role="progressbar"
                    aria-label={t('board.progressLabel', { name: j.name })}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={r.percent}
                    className="flex flex-col gap-1"
                  >
                    <p className="text-sm">{t('board.progress', { done: r.done, total: r.total })}</p>
                    <div className="h-2 w-full overflow-hidden rounded bg-black/10">
                      <div className="h-full bg-(--brand)" style={{ width: `${r.percent}%` }} />
                    </div>
                  </div>

                  {r.blockers.length > 0 ? (
                    <div className="flex flex-col gap-2">
                      <h3 className="text-sm font-semibold">{t('board.blockersTitle')}</h3>
                      <ul className="flex flex-col gap-2">
                        {r.blockers.map(b => (
                          <li key={b.taskId} className="rounded border border-amber-500 bg-amber-100 p-2 text-sm text-amber-900">
                            <p className="font-medium wrap-break-word">{b.title}</p>
                            <p>
                              {`${t('board.waitingOn', { role: t(`roles.${b.ownerRole}`) })} · ${
                                b.kind === 'today' ? t('board.dueToday') : t('board.overdue', { count: b.days })
                              }`}
                            </p>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : (
                    !complete && <p className="text-sm">{t('board.noBlockers')}</p>
                  )}
                </li>
              )
            })}
          </ul>
        </>
      )}
    </div>
  )
}