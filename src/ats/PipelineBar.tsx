import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Button, Input, Textarea, Tooltip } from '@heroui/react'
import type { Role } from '../lib/permissions'
import {
  pipelineButtons, todayString, validateHire, validateReason, type FormError, type PipelineAction,
} from './logic'
import type { CandidateDetail } from './types'

type Mode = 'reject' | 'hire' | null

type Props = {
  c: CandidateDetail
  role: Role | undefined
  busy: boolean
  failed: boolean
  onMove: (action: PipelineAction, body: Record<string, string> | undefined, done: () => void) => void
}

export default function PipelineBar({ c, role, busy, failed, onMove }: Props) {
  const { t } = useTranslation('ats')
  const [mode, setMode] = useState<Mode>(null)
  const [reason, setReason] = useState('')
  const [date, setDate] = useState('')
  const [location, setLocation] = useState('')
  const [error, setError] = useState<FormError | null>(null)

  const buttons = pipelineButtons(c, role)

  const close = () => {
    setMode(null)
    setError(null)
  }

  function open(next: Mode) {
    setReason('')
    setDate('')
    setLocation('')
    setError(null)
    setMode(next)
  }

  function submitReject(e: FormEvent) {
    e.preventDefault()
    const found = validateReason(reason)
    setError(found)
    if (found) return
    onMove('reject', { reason: reason.trim() }, close)
  }

  function submitHire(e: FormEvent) {
    e.preventDefault()
    const found = validateHire({ date, location }, todayString())
    setError(found)
    if (found) return
    onMove('hire', { joiningDate: date, location: location.trim() }, close)
  }

  if (buttons.length === 0) return null

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        {buttons.map(b => (
          <Tooltip key={b.action} content={t('panel.verifyFirst')} isDisabled={b.enabled}>
            <span className="inline-block">
              <Button
                className="min-h-11"
                color={b.action === 'reject' ? 'danger' : 'primary'}
                variant={b.action === 'reject' ? 'flat' : 'solid'}
                isDisabled={!b.enabled || busy}
                onPress={() => {
                  if (b.action === 'reject') open('reject')
                  else if (b.action === 'hire') open('hire')
                  else onMove(b.action, undefined, () => {})
                }}
              >
                {t(`pipeline.${b.action}`)}
              </Button>
            </span>
          </Tooltip>
        ))}
      </div>

      {c.verifiedAt === null && <p className="text-sm">{t('panel.verifyFirst')}</p>}

      {mode === 'reject' && (
        <form onSubmit={submitReject} noValidate className="flex flex-col gap-2 rounded-lg border p-3">
          <Textarea
            label={t('pipeline.rejectReason')}
            value={reason}
            onValueChange={setReason}
            isInvalid={error?.field === 'reason'}
            errorMessage={error?.field === 'reason' ? t(error.key) : undefined}
          />
          <div className="flex flex-wrap gap-2">
            <Button type="submit" color="danger" isLoading={busy}>{t('pipeline.rejectConfirm')}</Button>
            <Button type="button" variant="flat" onPress={close}>{t('pipeline.cancel')}</Button>
          </div>
        </form>
      )}

      {mode === 'hire' && (
        <form onSubmit={submitHire} noValidate className="flex flex-col gap-3 rounded-lg border p-3">
          <h4 className="font-semibold">{t('pipeline.hireTitle')}</h4>
          <label className="flex flex-col gap-1 text-sm">
            {t('pipeline.joiningDate')}
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              className="h-12 rounded-lg border bg-transparent px-2"
            />
            {error?.field === 'date' && (
              <span role="alert" className="text-red-600">{t(error.key)}</span>
            )}
          </label>
          <Input
            label={t('pipeline.location')}
            value={location}
            onValueChange={setLocation}
            isInvalid={error?.field === 'location'}
            errorMessage={error?.field === 'location' ? t(error.key) : undefined}
          />
          <div className="flex flex-wrap gap-2">
            <Button type="submit" color="primary" isLoading={busy}>{t('pipeline.hireConfirm')}</Button>
            <Button type="button" variant="flat" onPress={close}>{t('pipeline.cancel')}</Button>
          </div>
        </form>
      )}

      {failed && <p role="alert" className="text-red-600">{t('pipeline.error')}</p>}
    </div>
  )
}