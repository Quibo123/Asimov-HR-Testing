import { NavLink, Outlet } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

const tabClass = ({ isActive }: { isActive: boolean }) =>
  `inline-flex min-h-11 items-center ${isActive ? 'font-semibold underline' : ''}`

export default function OnboardLayout() {
  const { t } = useTranslation('onboard')
  return (
    <div className="flex flex-col gap-4">
      <nav aria-label={t('nav.label')} className="flex flex-wrap gap-4 border-b pb-2">
        <NavLink to="/onboard/templates" className={tabClass}>{t('nav.templates')}</NavLink>
        <NavLink to="/onboard/board" className={tabClass}>{t('nav.board')}</NavLink>
      </nav>
      <Outlet />
    </div>
  )
}