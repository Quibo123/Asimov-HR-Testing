import { useEffect } from 'react'
import { Link, Outlet } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { applyBrand, fakeBrandA } from '../theme/applyBrand'

export default function CareersLayout() {
  const { t } = useTranslation('careers')

  // Real tenant branding will come from the tenant's settings. A fake brand for now.
  useEffect(() => {
    applyBrand(fakeBrandA)
  }, [])

  return (
    <div className="min-h-screen flex flex-col">
      <header className="flex items-center gap-3 p-3 border-b-2 border-(--brand)">
        <img id="tenant-logo" alt={t('logoAlt')} className="h-8" />
        <Link to="/careers" className="font-semibold">{t('layoutTitle')}</Link>
      </header>
      <main className="mx-auto w-full max-w-2xl p-4">
        <Outlet />
      </main>
    </div>
  )
}