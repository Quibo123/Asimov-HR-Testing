import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Button, Input, Textarea } from '@heroui/react'
import { formatPoints, validateAdjustment, type AdjustError } from './logic'
import type { BreakdownItem } from './types'

type Props = {
  item: BreakdownItem
  busy: boolean
  failed: boolean
  onSave: (v: { points: number; reason: string }, onDone: () => void) => void
}

export default function AdjustForm({ item, busy, failed, onSave }: Props) {
  const { t } = useTranslation('ats')
  const [open, setOpen] = useState(false)
  const [points, setPoints] = useState('')
  const [reason, setReason] = useState('')
  const [error, setError] = useState<AdjustError | null>(null)

  function openForm() {
    setPoints(formatPoints(item.points))
    setReason('')
    setError(null)
    setOpen(true)
  }

  function submit(e: FormEvent) {
    e.preventDefault()
    const found = validateAdjustment({ points, reason }, item.weight)
    setError(found)
    if (found) return
    onSave({ points: Number(points), reason: reason.trim() }, () => setOpen(false))
  }

  if (!open) {
    return (
      <Button size="sm" variant="flat" className="mt-2" onPress={openForm}>
        {t('panel.adjust')}
      </Button>
    )
  }

  return (
    <form onSubmit={submit} noValidate className="mt-2 flex flex-col gap-2">
      <Input
        type="number"
        step="0.1"
        min={0}
        max={item.weight}
        label={t('panel.adjustPoints', { max: item.weight })}
        value={points}
        onValueChange={setPoints}
        isInvalid={error?.field === 'points'}
        errorMessage={error?.field === 'points' ? t(error.key, error.values) : undefined}
      />
      <Textarea
        label={t('panel.adjustReason')}
        value={reason}
        onValueChange={setReason}
        isInvalid={error?.field === 'reason'}
        errorMessage={error?.field === 'reason' ? t(error.key) : undefined}
      />
      {failed && <p role="alert" className="text-sm text-red-600">{t('panel.adjustError')}</p>}
      <div className="flex gap-2">
        <Button type="submit" size="sm" color="primary" isLoading={busy}>
          {t('panel.adjustSave')}
        </Button>
        <Button type="button" size="sm" variant="flat" onPress={() => setOpen(false)}>
          {t('panel.cancel')}
        </Button>
      </div>
    </form>
  )
}