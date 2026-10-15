import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Button } from '@heroui/react'
import { CheckCircle2 } from 'lucide-react'
import { ErrorState, SkeletonList } from '../components/states'
import { dayLabel } from '../lib/dayLabel'
import { formatInZone, zoneLabel } from '../lib/time'
import { useAuth } from '../auth/authContext'
import { addPunch, classifyPunchError, makeKey, nextType, startOrResume, stateOf } from './clockLogic'
import { clearPending, readPending, writePending } from './clockStorage'
import { todayKey, usePunch, useToday } from './queries'
import { useOnline } from './useOnline'
import type { Pending, Punch, TodayData } from './types'

type Message =
  | { kind: 'recorded'; punch: Punch }
  | { kind: 'conflict' }
  | { kind: 'refused' }

const errorText = 'text-red-700 dark:text-red-400'

// "09:02 GMT+5:30": the time in the location's zone, with the zone named
const stamp = (iso: string, zone: string) => `${formatInZone(iso, zone, 'HH:mm')} ${zoneLabel(zone)}`

export default function ClockPage() {
  const { t } = useTranslation('time')
  const { me } = useAuth()
  const userId = me?.id ?? ''
  const qc = useQueryClient()
  const online = useOnline()
  const today = useToday()
  const punch = usePunch()

  // A tap that was never confirmed is read back, so closing the app does not lose it
  const [pending, setPending] = useState<Pending | null>(() => readPending(userId))
  const [message, setMessage] = useState<Message | null>(null)

  const data = today.data

  if (!data) {
    if (today.isPending) return <SkeletonList rows={3} height="h-28" />
    return <ErrorState message={t('clock.loadError')} onRetry={() => void today.refetch()} />
  }

  const zone = data.location.timeZone
  const busy = punch.isPending
  const unsent = pending !== null && !busy
  const type = pending ? pending.type : nextType(stateOf(data.punches))

  async function send(p: Pending) {
    setMessage(null)
    try {
      const recorded = await punch.mutateAsync(p)
      clearPending(userId)
      setPending(null)
      qc.setQueryData<TodayData>(todayKey, old => (old ? { ...old, punches: addPunch(old.punches, recorded) } : old))
      void qc.invalidateQueries({ queryKey: todayKey })
      setMessage({ kind: 'recorded', punch: recorded })
    } catch (err) {
      const failure = classifyPunchError(err)
      if (failure === 'retry') return // the punch stays saved, and the button turns red
      clearPending(userId)
      setPending(null)
      setMessage({ kind: failure })
      void qc.invalidateQueries({ queryKey: todayKey })
    }
  }

  function tap() {
    if (busy) return // a second tap while sending must not start a second punch
    const p = startOrResume(pending, type, makeKey, new Date().toISOString())
    if (p !== pending) {
      writePending(userId, p) // saved on the phone BEFORE it is sent
      setPending(p)
    }
    void send(p)
  }

  const label = busy ? t('clock.sending') : unsent ? t('clock.notSent') : t(`clock.actions.${type}`)

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold">{t('clock.title')}</h1>
        <p className="text-sm opacity-80">{t('clock.today', { date: dayLabel(data.date) })}</p>
        <p className="text-sm opacity-80">
          {t('clock.location', { name: data.location.name, zone: zoneLabel(zone) })}
        </p>
      </div>

      <p className="rounded-lg border p-3 text-lg font-medium">
        {data.shift ? t('clock.shift', { start: data.shift.start, end: data.shift.end }) : t('clock.noShift')}
      </p>

      {!online && <p role="status" className="rounded-lg border-2 border-amber-500 p-3">{t('clock.offline')}</p>}

      <Button
        color={unsent ? 'danger' : 'primary'}
        className="min-h-24 w-full text-2xl font-semibold"
        isLoading={busy}
        onPress={tap}
      >
        {label}
      </Button>

      {unsent && pending && (
        <div role="alert" className="flex flex-col gap-1">
          <p className={errorText}>
            {t('clock.pending', {
              action: t(`clock.actions.${pending.type}`),
              time: stamp(pending.tappedAt, zone),
            })}
          </p>
          <p className="text-sm">{t('clock.retryNote')}</p>
        </div>
      )}

      {message?.kind === 'recorded' && (
        <div role="status" className="flex items-start gap-2 rounded-lg border-2 border-green-600 p-3">
          <CheckCircle2 aria-hidden="true" className="mt-1 shrink-0 text-green-700 dark:text-green-400" />
          <div>
            <p className="font-semibold">
              {t('clock.recorded', {
                action: t(`clock.actions.${message.punch.type}`),
                time: stamp(message.punch.at, zone),
              })}
            </p>
            <p className="text-sm opacity-80">{t('clock.recordedZone', { name: data.location.name })}</p>
          </div>
        </div>
      )}
      {message?.kind === 'conflict' && <p role="alert" className={errorText}>{t('clock.conflict')}</p>}
      {message?.kind === 'refused' && <p role="alert" className={errorText}>{t('clock.refused')}</p>}

      <section aria-label={t('clock.timeline')} className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">{t('clock.timeline')}</h2>
        {data.punches.length === 0 && !pending && <p className="opacity-80">{t('clock.empty')}</p>}
        <ol className="flex flex-col gap-2 border-l-2 pl-4">
          {data.punches.map(x => (
            <li key={x.id}>
              <p className="font-medium">{t(`clock.actions.${x.type}`)}</p>
              <p className="text-sm">{stamp(x.at, zone)}</p>
            </li>
          ))}
          {pending && (
            <li>
              <p className="font-medium">{t(`clock.actions.${pending.type}`)}</p>
              <p className={`text-sm ${errorText}`}>
                {`${stamp(pending.tappedAt, zone)} · ${t('clock.unsent')}`}
              </p>
            </li>
          )}
        </ol>
      </section>
    </div>
  )
}