import { NavLink, Outlet } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

const tabClass = ({ isActive }: { isActive: boolean }) => (isActive ? 'font-semibold underline' : '')

export default function TalentlyLayout() {
  const { t } = useTranslation('ats')
  return (
    <div className="flex flex-col gap-4">
      <nav className="flex gap-4 border-b pb-2">
        <NavLink to="/talently/templates" className={tabClass}>{t('tabs.templates')}</NavLink>
        <NavLink to="/talently/candidates" className={tabClass}>{t('tabs.candidates')}</NavLink>
      </nav>
      <Outlet />
    </div>
  )
}