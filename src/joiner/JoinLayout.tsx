import { useEffect } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { applyBrand, fakeBrandA } from '../theme/applyBrand'
import { resolveDark } from './logic'

export default function JoinLayout() {
  const { t } = useTranslation('joiner')
  const { search } = useLocation()

  // Real tenant branding will come from the tenant's settings. A fake brand for now.
  useEffect(() => {
    applyBrand(fakeBrandA)
  }, [])

  // The joiner's phone decides light or dark. ?theme=dark / ?theme=light overrides it, for QA.
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const apply = () => {
      const dark = resolveDark(search, media.matches)
      document.documentElement.classList.toggle('dark', dark)
      document.documentElement.style.colorScheme = dark ? 'dark' : 'light'
    }
    apply()
    media.addEventListener('change', apply)
    return () => {
      media.removeEventListener('change', apply)
      document.documentElement.classList.remove('dark')
      document.documentElement.style.colorScheme = ''
    }
  }, [search])

  return (
    <div className="flex min-h-screen flex-col text-lg">
      <header className="flex items-center gap-3 border-b-2 border-(--brand) p-3">
        <img id="tenant-logo" alt={t('logoAlt')} className="h-8" />
        <span className="font-semibold">{t('layoutTitle')}</span>
      </header>
      <main className="mx-auto w-full min-w-0 max-w-md p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <Outlet />
      </main>
    </div>
  )
}