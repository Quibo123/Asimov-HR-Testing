import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Button, Textarea } from '@heroui/react'
import { validateNote } from './logic'
import type { Note } from './types'

type Props = {
  notes: Note[]
  canAdd: boolean
  busy: boolean
  failed: boolean
  when: (iso: string) => string
  onAdd: (v: { text: string; rating: number | null }, done: () => void) => void
}

export default function NotesSection({ notes, canAdd, busy, failed, when, onAdd }: Props) {
  const { t } = useTranslation('ats')
  const [text, setText] = useState('')
  const [rating, setRating] = useState('')
  const [missing, setMissing] = useState(false)

  function submit(e: FormEvent) {
    e.preventDefault()
    const found = validateNote(text)
    setMissing(found !== null)
    if (found) return
    onAdd({ text: text.trim(), rating: rating === '' ? null : Number(rating) }, () => {
      setText('')
      setRating('')
    })
  }

  return (
    <section aria-label={t('notes.title')} className="flex flex-col gap-3">
      <h3 className="font-semibold">{t('notes.title')}</h3>

      {canAdd && (
        <form onSubmit={submit} noValidate className="flex flex-col gap-2">
          <Textarea
            label={t('notes.text')}
            value={text}
            onValueChange={v => { setText(v); setMissing(false) }}
            isInvalid={missing}
            errorMessage={missing ? t('errors.note') : undefined}
          />
          <select
            aria-label={t('notes.rating')}
            className="h-12 rounded-lg border bg-transparent px-2"
            value={rating}
            onChange={e => setRating(e.target.value)}
          >
            <option value="">{t('notes.ratingNone')}</option>
            {[1, 2, 3, 4, 5].map(n => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
          {failed && <p role="alert" className="text-red-600">{t('notes.error')}</p>}
          <Button type="submit" color="primary" className="min-h-11 self-start" isLoading={busy}>
            {t('notes.add')}
          </Button>
        </form>
      )}

      {notes.length === 0 && <p className="text-sm">{t('notes.empty')}</p>}

      <ul className="flex flex-col gap-2">
        {[...notes].reverse().map(n => (
          <li key={n.id} className="rounded-lg border p-3">
            <p className="whitespace-pre-line wrap-break-word">{n.text}</p>
            {n.rating !== null && <p className="text-sm font-medium">{t('notes.ratingOf', { n: n.rating })}</p>}
            <p className="text-sm opacity-70">{t('notes.byWhen', { who: n.by, when: when(n.at) })}</p>
          </li>
        ))}
      </ul>
    </section>
  )
}