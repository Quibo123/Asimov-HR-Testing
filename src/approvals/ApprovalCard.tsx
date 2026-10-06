import { Fragment, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Button, Textarea } from '@heroui/react'
import { formatInZone, zoneLabel } from '../lib/time'
import { localZone } from '../ats/logic'
import type { Approval } from './types'

type Props = {
  approval: Approval
  onDecide: (kind: 'approve' | 'reject', reason?: string) => void
}

export default function ApprovalCard({ approval: a, onDecide }: Props) {
  const { t } = useTranslation('approvals')
  const [rejecting, setRejecting] = useState(false)
  const [reason, setReason] = useState('')
  const [missing, setMissing] = useState(false)
  const zone = localZone()

  function submitReject(e: FormEvent) {
    e.preventDefault()
    if (!reason.trim()) {
      setMissing(true)
      return
    }
    onDecide('reject', reason.trim())
  }

  return (
    <li className="flex flex-col gap-3 rounded-lg border p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded border px-2 py-0.5 text-xs font-medium">
          {t(`types.${a.type}`, { defaultValue: a.type })}
        </span>
        <h3 className="wrap-break-word font-semibold">{a.title}</h3>
      </div>

      <p className="text-sm opacity-80">
        {`${t('requestedBy', { who: a.requester })} · ${formatInZone(a.requestedAt, zone, 'd MMM yyyy, HH:mm')} ${zoneLabel(zone)}`}
      </p>

      {a.balance && (
        <p className="rounded-lg border-2 border-(--brand) p-3">
          <span className="block text-sm">{a.balance.label}</span>
          <span className="text-lg font-semibold">{a.balance.value}</span>
        </p>
      )}

      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
        {a.details.map(d => (
          <Fragment key={d.label}>
            <dt className="opacity-70">{d.label}</dt>
            <dd className="wrap-break-word">{d.value}</dd>
          </Fragment>
        ))}
      </dl>

      {!rejecting ? (
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button color="primary" className="min-h-11" onPress={() => onDecide('approve')}>
            {t('approve')}
          </Button>
          <Button color="danger" variant="flat" className="min-h-11" onPress={() => setRejecting(true)}>
            {t('reject')}
          </Button>
        </div>
      ) : (
        <form onSubmit={submitReject} noValidate className="flex flex-col gap-2">
          <Textarea
            label={t('rejectReason')}
            value={reason}
            onValueChange={v => { setReason(v); setMissing(false) }}
            isInvalid={missing}
            errorMessage={missing ? t('errors.reason') : undefined}
          />
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button type="submit" color="danger" className="min-h-11">{t('rejectConfirm')}</Button>
            <Button type="button" variant="flat" className="min-h-11" onPress={() => setRejecting(false)}>
              {t('cancel')}
            </Button>
          </div>
        </form>
      )}
    </li>
  )
}