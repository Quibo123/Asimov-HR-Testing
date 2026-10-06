import { useTranslation } from 'react-i18next'
import { useAuth } from '../auth/authContext'
import { can } from '../lib/permissions'
import ApprovalsInbox from '../approvals/ApprovalsInbox'

export default function Home() {
  const { t } = useTranslation()
  const { me } = useAuth()
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <h1 className="text-xl font-semibold">{t('nav.home')}</h1>
      {can(me?.role, 'approvals.decide') && <ApprovalsInbox />}
    </div>
  )
}