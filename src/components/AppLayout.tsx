import { useEffect, useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { Menu } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { applyBrand, fakeBrandA, fakeBrandB } from '../theme/applyBrand'
import { supabase } from '../lib/supabase'
import { useAuth } from '../auth/authContext'

const modules = [
  { path: '/talently', key: 'nav.talently' },
  { path: '/people', key: 'nav.people' },
  { path: '/onboard', key: 'nav.onboard' },
  { path: '/time', key: 'nav.time' },
  { path: '/settings', key: 'nav.settings' },
]

export default function AppLayout() {
  const { t } = useTranslation()
  const { me } = useAuth()
  const [open, setOpen] = useState(false)

  // Show a logo as soon as the shell appears
  useEffect(() => {
    applyBrand(fakeBrandA)
  }, [])

  return (
    <div className="min-h-screen flex flex-col">
      <header className="flex items-center gap-2 border-b p-3 md:gap-4">
        <button
          className="inline-flex min-h-11 min-w-11 items-center justify-center md:hidden"
          aria-label={t('menu')}
          onClick={() => setOpen(!open)}
        >
          <Menu />
        </button>

        <img id="tenant-logo" alt={t('logoAlt')} className="h-8" />

        <nav className="hidden md:flex gap-3">
          {modules.map(m => (
            <NavLink key={m.path} to={m.path}>{t(m.key)}</NavLink>
          ))}
        </nav>

        <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
          <button className="hidden md:inline" onClick={() => applyBrand(fakeBrandA)}>{t('brand.a')}</button>
          <button className="hidden md:inline" onClick={() => applyBrand(fakeBrandB)}>{t('brand.b')}</button>
          <button className="hidden md:inline" onClick={() => document.documentElement.classList.toggle('dark')}>
            {t('theme.toggle')}
          </button>
          <span className="hidden max-w-40 truncate sm:inline">{me?.email ?? t('user')}</span>
          <button className="min-h-11 px-2" onClick={() => supabase.auth.signOut()}>{t('signOut')}</button>
        </div>
      </header>

      <div className="flex flex-1 flex-col md:flex-row">
        <aside className={`${open ? 'block' : 'hidden'} w-full border-b p-3 md:block md:w-48 md:border-b-0 md:border-r`}>
          {modules.map(m => (
            <NavLink
              key={m.path}
              to={m.path}
              className="flex min-h-11 items-center"
              onClick={() => setOpen(false)}
            >
              {t(m.key)}
            </NavLink>
          ))}
        </aside>
        <main className="min-w-0 flex-1 p-4">
          <Outlet />
        </main>
      </div>
    </div>
  )
}