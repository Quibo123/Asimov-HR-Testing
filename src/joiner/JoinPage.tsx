import { useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ErrorState, SkeletonList } from '../components/states'
import { PublicApiError } from '../lib/publicApi'
import JoinFlow from './JoinFlow'
import { useJoiner } from './queries'

export default function JoinPage() {
  const { t } = useTranslation('joiner')
  const { token = '' } = useParams()
  const { data, isPending, isError, error, refetch } = useJoiner(token)

  if (isPending) return <SkeletonList rows={3} height="h-24" />

  if (isError) {
    const gone = error instanceof PublicApiError && (error.status === 404 || error.status === 410)
      if (gone) return <p role="alert" className="text-red-700 dark:text-red-400">{t('invalid')}</p>
    return <ErrorState message={t('error')} onRetry={() => void refetch()} />
  }

  return <JoinFlow key={token} token={token} view={data} />
}