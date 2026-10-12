import { useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { applyBrand, fakeBrandA } from '../theme/applyBrand'

export default function JoinLayout() {
  const { t } = useTranslation('joiner')

  // Real tenant branding will come from the tenant's settings. A fake brand for now.
  useEffect(() => {
    applyBrand(fakeBrandA)
  }, [])

  return (
    <div className="flex min-h-screen flex-col text-lg">
      <header className="flex items-center gap-3 border-b-2 border-(--brand) p-3">
        <img id="tenant-logo" alt={t('logoAlt')} className="h-8" />
        <span className="font-semibold">{t('layoutTitle')}</span>
      </header>
      <main className="mx-auto w-full min-w-0 max-w-md p-4">
        <Outlet />
      </main>
    </div>
  )
}