import { NavLink, Outlet } from 'react-router-dom'
import { useState } from 'react'
import { Menu } from 'lucide-react'

const modules = [
  { path: '/talently', label: 'Talently' },
  { path: '/people', label: 'People' },
  { path: '/onboard', label: 'Onboard' },
  { path: '/time', label: 'Time' },
  { path: '/settings', label: 'Settings' },
]

export default function AppLayout() {
  const [open, setOpen] = useState(false)
  return (
    <div className="min-h-screen flex flex-col">
      <header className="flex items-center gap-4 p-3 border-b">
        <button className="md:hidden" onClick={() => setOpen(!open)}>
          <Menu />
        </button>
        <img id="tenant-logo" alt="logo" className="h-8" />
        <nav className="hidden md:flex gap-3">
          {modules.map(m => (
            <NavLink key={m.path} to={m.path}>{m.label}</NavLink>
          ))}
        </nav>
        <div className="ml-auto">User</div>
      </header>
      <div className="flex flex-1">
        <aside className={`${open ? 'block' : 'hidden'} md:block w-48 p-3 border-r`}>
          {modules.map(m => (
            <NavLink key={m.path} to={m.path} className="block py-1">{m.label}</NavLink>
          ))}
        </aside>
        <main className="flex-1 p-4"><Outlet /></main>
      </div>
    </div>
  )
}