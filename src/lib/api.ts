import { supabase } from './supabase'

const BASE = import.meta.env.VITE_API_URL

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token

  // A file upload must not get a JSON content type: the browser adds the multipart boundary
  const isForm = options.body instanceof FormData

  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      ...(isForm ? {} : { 'Content-Type': 'application/json' }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  })

  // Logged in but the server says the token is bad: go back to sign-in
  if (res.status === 401 && token) {
    await supabase.auth.signOut()
    window.location.assign('/signin')
    throw new ApiError(401, 'Unauthorized')
  }

  if (!res.ok) {
    throw new ApiError(res.status, await res.text())
  }

  return res.status === 204 ? (undefined as T) : ((await res.json()) as T)
}