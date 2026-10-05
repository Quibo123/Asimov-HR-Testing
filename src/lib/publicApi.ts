const BASE = import.meta.env.VITE_API_URL

export class PublicApiError extends Error {
  status: number
  constructor(status: number) {
    super(`HTTP ${status}`)
    this.status = status
  }
}

// fetch() throws a TypeError when the network drops, which the form treats as "Try again"
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, init)
  if (!res.ok) throw new PublicApiError(res.status)
  return res.status === 204 ? (undefined as T) : ((await res.json()) as T)
}

export const getPublic = <T>(path: string) => request<T>(path)

// No Content-Type header here: the browser sets it, with the multipart boundary
export const postForm = <T>(path: string, form: FormData) =>
  request<T>(path, { method: 'POST', body: form })