import { useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { api } from '../lib/api'
import { AuthContext, type Me } from './authContext'

// Remembers which session the "me" data belongs to
type MeResult = { sessionId: string; me: Me | null }

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [checked, setChecked] = useState(false)
  const [meResult, setMeResult] = useState<MeResult | null>(null)

  // Supabase tells us when the user signs in or out
  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s)
      setChecked(true)
    })
    return () => data.subscription.unsubscribe()
  }, [])

  // When there is a session, ask the API who this user is and what role they have.
  // State is only set inside the .then/.catch callbacks (after the request),
  // never synchronously inside the effect.
  const token = session?.access_token ?? null
  useEffect(() => {
    if (!token) return
    let cancelled = false

    api<Me>('/me')
      .then(data => {
        if (!cancelled) setMeResult({ sessionId: token, me: data })
      })
      .catch(() => {
        if (!cancelled) setMeResult({ sessionId: token, me: null })
      })

    return () => {
      cancelled = true
    }
  }, [token])

  // Derived during render, so there is no setState(null) when signed out
  const me = token && meResult?.sessionId === token ? meResult.me : null
  const meLoading = !!token && meResult?.sessionId !== token

  return (
    <AuthContext.Provider value={{ session, me, loading: !checked || meLoading }}>
      {children}
    </AuthContext.Provider>
  )
}