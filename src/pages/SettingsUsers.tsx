import { useEffect, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Button, Input } from '@heroui/react'
import { api } from '../lib/api'
import { can, type Role } from '../lib/permissions'
import { useAuth } from '../auth/authContext'

type UserRow = { id: string; email: string; role: Role }
const ROLES: Role[] = ['owner', 'admin', 'member', 'interviewer']

export default function SettingsUsers() {
  const { t } = useTranslation('settings')
  const { me } = useAuth()
  const [users, setUsers] = useState<UserRow[]>([])
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<Role>('member')
  const [message, setMessage] = useState<string | null>(null)
  const [errorText, setErrorText] = useState<string | null>(null)
  // Changing this number makes the list load again
  const [reloadKey, setReloadKey] = useState(0)

  // Load the list. State is set only after the request finishes.
  useEffect(() => {
    let cancelled = false

    api<UserRow[]>('/users')
      .then(data => {
        if (!cancelled) setUsers(data)
      })
      .catch(() => {
        if (!cancelled) setErrorText(t('users.error'))
      })

    return () => {
      cancelled = true
    }
  }, [reloadKey, t])

  const reload = () => setReloadKey(k => k + 1)

  // The last owner is protected in the UI (the API also blocks it)
  const ownerCount = users.filter(u => u.role === 'owner').length
  const isLastOwner = (u: UserRow) => u.role === 'owner' && ownerCount === 1

  async function handleInvite(e: FormEvent) {
    e.preventDefault()
    setMessage(null)
    setErrorText(null)
    try {
      await api('/invites', { method: 'POST', body: JSON.stringify({ email, role }) })
      setEmail('')
      setMessage(t('users.invited'))
    } catch {
      setErrorText(t('users.error'))
    }
  }

  async function handleChangeRole(id: string, newRole: Role) {
    setErrorText(null)
    try {
      await api(`/users/${id}/role`, { method: 'PATCH', body: JSON.stringify({ role: newRole }) })
      reload()
    } catch {
      setErrorText(t('users.error'))
    }
  }

  async function handleRemove(id: string) {
    if (!window.confirm(t('users.confirmRemove'))) return
    setErrorText(null)
    try {
      await api(`/users/${id}`, { method: 'DELETE' })
      reload()
    } catch {
      setErrorText(t('users.error'))
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold">{t('users.title')}</h1>

      {can(me?.role, 'users.invite') && (
        <form onSubmit={handleInvite} className="flex flex-wrap items-end gap-2">
          <Input
            type="email"
            label={t('users.email')}
            value={email}
            onValueChange={setEmail}
            isRequired
            className="max-w-xs"
          />
          <select
            aria-label={t('users.role')}
            className="h-14 rounded-lg border px-2 bg-transparent"
            value={role}
            onChange={e => setRole(e.target.value as Role)}
          >
            {ROLES.map(r => (
              <option key={r} value={r}>{t(`roles.${r}`)}</option>
            ))}
          </select>
          <Button type="submit" color="primary">{t('users.send')}</Button>
        </form>
      )}

      {message && <p>{message}</p>}
      {errorText && <p role="alert" className="text-red-600">{errorText}</p>}

      {can(me?.role, 'users.view') && (
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr>
                <th className="p-2">{t('users.email')}</th>
                <th className="p-2">{t('users.role')}</th>
                <th className="p-2">{t('users.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id} className="border-t">
                  <td className="p-2">{u.email}</td>
                  <td className="p-2">
                    {can(me?.role, 'users.changeRole') && !isLastOwner(u) ? (
                      <select
                        aria-label={t('users.role')}
                        className="rounded border px-1 bg-transparent"
                        value={u.role}
                        onChange={e => handleChangeRole(u.id, e.target.value as Role)}
                      >
                        {ROLES.map(r => (
                          <option key={r} value={r}>{t(`roles.${r}`)}</option>
                        ))}
                      </select>
                    ) : (
                      t(`roles.${u.role}`)
                    )}
                  </td>
                  <td className="p-2">
                    {isLastOwner(u) ? (
                      <span className="text-sm opacity-70">{t('users.lastOwner')}</span>
                    ) : (
                      can(me?.role, 'users.remove') && (
                        <Button
                          size="sm"
                          color="danger"
                          variant="flat"
                          onPress={() => handleRemove(u.id)}
                        >
                          {t('users.remove')}
                        </Button>
                      )
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}