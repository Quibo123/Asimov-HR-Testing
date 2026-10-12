const BASE = import.meta.env.VITE_API_URL
const TENANT = import.meta.env.VITE_TENANT_ID

export class PublicApiError extends Error {
  status: number
  constructor(status: number) {
    super(`HTTP ${status}`)
    this.status = status
  }
}

// The public pages have no sign-in, so the company (tenant) is sent with every call
const tenantHeaders = (): Record<string, string> => (TENANT ? { 'X-Tenant-ID': TENANT } : {})

// fetch() throws a TypeError when the network drops, which the screens treat as "Not sent"
async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { ...tenantHeaders(), ...init.headers },
  })
  if (!res.ok) throw new PublicApiError(res.status)
  return res.status === 204 ? (undefined as T) : ((await res.json()) as T)
}

export const getPublic = <T>(path: string) => request<T>(path)

export const postJson = <T>(path: string, data: unknown) =>
  request<T>(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })

// No Content-Type header here: the browser sets it, with the multipart boundary
export const postForm = <T>(path: string, form: FormData) =>
  request<T>(path, { method: 'POST', body: form })

// fetch cannot report upload progress, so file uploads use XMLHttpRequest
export function postFormProgress<T>(
  path: string,
  form: FormData,
  onProgress: (percent: number) => void,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', `${BASE}${path}`)
    for (const [name, value] of Object.entries(tenantHeaders())) xhr.setRequestHeader(name, value)
    xhr.upload.onprogress = e => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100))
    }
    xhr.onload = () => {
      if (xhr.status < 200 || xhr.status >= 300) return reject(new PublicApiError(xhr.status))
      try {
        resolve((xhr.responseText ? JSON.parse(xhr.responseText) : undefined) as T)
      } catch {
        resolve(undefined as T)
      }
    }
    // A dropped network ends up here, which the screens treat as "Not sent"
    xhr.onerror = () => reject(new TypeError('network'))
    xhr.ontimeout = () => reject(new TypeError('timeout'))
    xhr.send(form)
  })
}