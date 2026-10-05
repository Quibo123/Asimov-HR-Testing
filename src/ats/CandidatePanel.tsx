import { useTranslation } from 'react-i18next'
import { Button, Tooltip } from '@heroui/react'
import { formatInZone, zoneLabel } from '../lib/time'
import { useCandidate, useCandidateActions } from './queries'
import { canShortlist, formatPoints, localZone, sumOriginal } from './logic'
import AdjustForm from './AdjustForm'

type Props = { id: string; onClose: () => void }

export default function CandidatePanel({ id, onClose }: Props) {
  const { t } = useTranslation('ats')
  const { data: c, isPending, isError } = useCandidate(id)
  const actions = useCandidateActions(id)

  const zone = localZone()
  const when = (iso: string) => `${formatInZone(iso, zone, 'd MMM yyyy, HH:mm')} ${zoneLabel(zone)}`

  const verified = c !== undefined && c.verifiedAt !== null
  const totalChanged = c !== undefined && formatPoints(c.score) !== formatPoints(sumOriginal(c.breakdown))

  return (
    <aside
      role="dialog"
      aria-label={t('panel.title')}
      className="fixed inset-y-0 right-0 z-30 flex w-full flex-col border-l bg-(--surface) shadow-xl md:w-[min(92vw,1100px)]"
    >
      <div className="flex items-center justify-between gap-2 border-b p-3">
        <h2 className="text-lg font-semibold">{c ? c.name : t('panel.title')}</h2>
        <Button size="sm" variant="flat" onPress={onClose}>{t('panel.close')}</Button>
      </div>

      <div className="flex-1 overflow-auto">
        {isPending && <p className="p-4">{t('panel.loading')}</p>}
        {isError && <p role="alert" className="p-4">{t('panel.error')}</p>}

        {c && (
          <div className="flex flex-col gap-4 p-4">
            <p className="text-sm opacity-80">
              {`${c.jobTitle} · ${t('panel.applied', { when: when(c.appliedAt) })}`}
            </p>

            <div className="flex flex-wrap items-center gap-3">
              {c.verifiedAt && c.verifiedBy ? (
                <p role="status">{t('panel.verifiedBy', { who: c.verifiedBy, when: when(c.verifiedAt) })}</p>
              ) : (
                <>
                  <p>{t('panel.notVerified')}</p>
                  <Button
                    variant="bordered"
                    isLoading={actions.verify.isPending}
                    onPress={() => actions.verify.mutate()}
                  >
                    {t('panel.verify')}
                  </Button>
                </>
              )}

              <Tooltip content={t('panel.verifyFirst')} isDisabled={verified}>
                <span className="inline-block">
                  <Button
                    color="primary"
                    isDisabled={!canShortlist(c)}
                    isLoading={actions.shortlist.isPending}
                    onPress={() => actions.shortlist.mutate()}
                  >
                    {c.status === 'shortlisted' ? t('panel.shortlisted') : t('panel.shortlist')}
                  </Button>
                </span>
              </Tooltip>
            </div>

            {!verified && <p className="text-sm">{t('panel.verifyFirst')}</p>}
            {actions.verify.isError && <p role="alert" className="text-red-600">{t('panel.verifyError')}</p>}
            {actions.shortlist.isError && <p role="alert" className="text-red-600">{t('panel.shortlistError')}</p>}

            <div>
              <p className="text-lg font-semibold">{t('panel.total', { n: formatPoints(c.score) })}</p>
              {totalChanged && (
                <p className="text-sm opacity-80">
                  {t('panel.originalTotal', { n: formatPoints(sumOriginal(c.breakdown)) })}
                </p>
              )}
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <section aria-label={t('panel.resume')}>
                <h3 className="mb-2 font-semibold">{t('panel.resume')}</h3>
                <iframe title={t('panel.resume')} src={c.resumeUrl} className="h-[70vh] w-full rounded-lg border" />
              </section>

              <section aria-label={t('panel.breakdown')} className="flex flex-col gap-3">
                <h3 className="font-semibold">{t('panel.breakdown')}</h3>
                <ol className="flex flex-col gap-3">
                  {c.breakdown.map(item => (
                    <li key={item.questionId} className="rounded-lg border p-3">
                      <p className="font-medium">{item.label}</p>
                      <p>{item.answer ?? t('panel.noAnswer')}</p>
                      <p className="text-sm">
                        {t('panel.weightPoints', { weight: item.weight, points: formatPoints(item.points) })}
                      </p>

                      {item.mustHave && !item.mustHaveMet && (
                        <p role="note" className="mt-1 rounded border border-amber-500 bg-amber-100 px-2 py-1 text-sm text-amber-900">
                          {t('panel.flag')}
                        </p>
                      )}

                      {item.adjustment && (
                        <p className="mt-1 text-sm">
                          {t('panel.adjusted', {
                            from: formatPoints(item.originalPoints),
                            to: formatPoints(item.points),
                            who: item.adjustment.by,
                            when: when(item.adjustment.at),
                            reason: item.adjustment.reason,
                          })}
                        </p>
                      )}

                      <AdjustForm
                        item={item}
                        busy={actions.adjust.isPending}
                        failed={actions.adjust.isError && actions.adjust.variables?.questionId === item.questionId}
                        onSave={(v, done) =>
                          actions.adjust.mutate({ questionId: item.questionId, ...v }, { onSuccess: done })
                        }
                      />
                    </li>
                  ))}
                </ol>
              </section>
            </div>
          </div>
        )}
      </div>
    </aside>
  )
}