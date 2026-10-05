import { createContext, useContext } from 'react'
import type { Session } from '@supabase/supabase-js'
import type { Role } from '../lib/permissions'

export type Me = { id: string; email: string; role: Role }

export type AuthState = {
  session: Session | null
  me: Me | null
  loading: boolean
}

export const AuthContext = createContext<AuthState>({
  session: null,
  me: null,
  loading: true,
})

export const useAuth = () => useContext(AuthContext)