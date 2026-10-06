import { useTranslation } from 'react-i18next'
import type { HistoryEntry } from './types'

type Props = { history: HistoryEntry[]; when: (iso: string) => string }

export default function HistoryTimeline({ history, when }: Props) {
  const { t } = useTranslation('ats')
  return (
    <section aria-label={t('history.title')} className="flex flex-col gap-2">
      <h3 className="font-semibold">{t('history.title')}</h3>
      <ol className="flex flex-col gap-3 border-l-2 pl-4">
        {history.map(h => (
          <li key={h.id}>
            <p className="font-medium">{t(`status.${h.status}`)}</p>
            <p className="text-sm">{t('history.byWhen', { who: h.by, when: when(h.at) })}</p>
            {h.reason && <p className="text-sm">{t('history.reason', { reason: h.reason })}</p>}
          </li>
        ))}
      </ol>
    </section>
  )
}