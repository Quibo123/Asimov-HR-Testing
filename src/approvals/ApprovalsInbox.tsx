import { useTranslation } from 'react-i18next'
import { Button } from '@heroui/react'
import { useApprovals, useDecide } from './queries'
import ApprovalCard from './ApprovalCard'

export default function ApprovalsInbox() {
  const { t } = useTranslation('approvals')
  const { data, isPending, isError, refetch } = useApprovals()
  const decide = useDecide()

  return (
    <section aria-label={t('title')} className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline gap-2">
        <h2 className="text-lg font-semibold">{t('title')}</h2>
        {data && data.length > 0 && (
          <span className="rounded-full border px-2 text-sm">{t('count', { n: data.length })}</span>
        )}
      </div>

      {isPending && <p>{t('loading')}</p>}

      {isError && (
        <div role="alert" className="flex flex-col items-start gap-2">
          <p>{t('error')}</p>
          <Button className="min-h-11" onPress={() => void refetch()}>{t('retry')}</Button>
        </div>
      )}

      {decide.isError && <p role="alert" className="text-red-600">{t('decideError')}</p>}

      {data && data.length === 0 && <p>{t('empty')}</p>}

      {data && data.length > 0 && (
        <ul className="flex flex-col gap-3">
          {data.map(a => (
            <ApprovalCard
              key={a.id}
              approval={a}
              onDecide={(kind, reason) => decide.mutate({ id: a.id, kind, reason })}
            />
          ))}
        </ul>
      )}
    </section>
  )
}