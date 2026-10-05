import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Button, Input } from '@heroui/react'
import { supabase } from '../lib/supabase'

export default function SignIn() {
  const { t } = useTranslation('auth')
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errorText, setErrorText] = useState<string | null>(null)
  const [infoText, setInfoText] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function handlePasswordSignIn(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setErrorText(null)
    setInfoText(null)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setBusy(false)
    if (error) setErrorText(t('errors.signIn'))
    else navigate('/', { replace: true })
  }

  async function handleMagicLink() {
    setBusy(true)
    setErrorText(null)
    setInfoText(null)
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin },
    })
    setBusy(false)
    if (error) setErrorText(t('errors.magic'))
    else setInfoText(t('magicSent'))
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <form onSubmit={handlePasswordSignIn} className="w-full max-w-sm flex flex-col gap-3">
        <h1 className="text-2xl font-semibold">{t('title')}</h1>
        <Input type="email" label={t('email')} value={email} onValueChange={setEmail} isRequired />
        <Input type="password" label={t('password')} value={password} onValueChange={setPassword} />
        {errorText && <p role="alert" className="text-red-600">{errorText}</p>}
        {infoText && <p>{infoText}</p>}
        <Button type="submit" color="primary" isLoading={busy}>{t('signIn')}</Button>
        <Button type="button" variant="bordered" onPress={handleMagicLink} isDisabled={busy || !email}>
          {t('magicLink')}
        </Button>
      </form>
    </div>
  )
}