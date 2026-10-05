import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Button, Input } from '@heroui/react'
import { api, ApiError } from '../lib/api'
import { supabase } from '../lib/supabase'

type Invite = { email: string; role: string; expiresAt: string }
type Status = 'checking' | 'ok' | 'expired' | 'invalid'

export default function Accept() {
  const { t } = useTranslation('auth')
  const { token } = useParams()
  const navigate = useNavigate()
  const [invite, setInvite] = useState<Invite | null>(null)
  const [status, setStatus] = useState<Status>('checking')
  const [password, setPassword] = useState('')
  const [errorText, setErrorText] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    api<Invite>(`/invites/${token}`)
      .then(data => {
        // Invites last 7 days. The server sets expiresAt, we just read it.
        const expired = new Date(data.expiresAt).getTime() < Date.now()
        setInvite(data)
        setStatus(expired ? 'expired' : 'ok')
      })
      .catch(err => {
        const code = err instanceof ApiError ? err.status : 0
        setStatus(code === 410 ? 'expired' : 'invalid')
      })
  }, [token])

  async function handleAccept(e: FormEvent) {
    e.preventDefault()
    if (!invite) return
    setBusy(true)
    setErrorText(null)
    try {
      await api('/invites/accept', { method: 'POST', body: JSON.stringify({ token, password }) })
      const { error } = await supabase.auth.signInWithPassword({ email: invite.email, password })
      if (error) throw error
      navigate('/', { replace: true })
    } catch (err) {
      setStatus(err instanceof ApiError && err.status === 410 ? 'expired' : 'ok')
      setErrorText(t('accept.failed'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-sm flex flex-col gap-3">
        <h1 className="text-2xl font-semibold">{t('accept.title')}</h1>
        {status === 'checking' && <p>{t('accept.checking')}</p>}
        {status === 'expired' && <p role="alert">{t('accept.expired')}</p>}
        {status === 'invalid' && <p role="alert">{t('accept.invalid')}</p>}
        {status === 'ok' && invite && (
          <form onSubmit={handleAccept} className="flex flex-col gap-3">
            <Input type="email" label={t('email')} value={invite.email} isReadOnly />
            <Input type="password" label={t('accept.setPassword')} value={password}
                   onValueChange={setPassword} isRequired minLength={8} />
            {errorText && <p role="alert" className="text-red-600">{errorText}</p>}
            <Button type="submit" color="primary" isLoading={busy}>{t('accept.submit')}</Button>
          </form>
        )}
      </div>
    </div>
  )
}