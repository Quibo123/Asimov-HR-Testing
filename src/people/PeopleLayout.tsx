import { NavLink, Outlet } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { can } from '../lib/permissions'
import { useAuth } from '../auth/authContext'

const tabClass = ({ isActive }: { isActive: boolean }) =>
  `inline-flex min-h-11 items-center ${isActive ? 'font-semibold underline' : ''}`

export default function PeopleLayout() {
  const { t } = useTranslation('people')
  const { me } = useAuth()
  return (
    <div className="flex flex-col gap-4">
      <nav aria-label={t('nav.label')} className="flex flex-wrap gap-4 border-b pb-2">
        <NavLink to="/people/directory" className={tabClass}>{t('nav.directory')}</NavLink>
        <NavLink to="/people/org" className={tabClass}>{t('nav.org')}</NavLink>
        {can(me?.role, 'people.import') && (
          <NavLink to="/people/import" className={tabClass}>{t('nav.import')}</NavLink>
        )}
      </nav>
      <Outlet />
    </div>
  )
}