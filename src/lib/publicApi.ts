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

// fetch cannot report upload progress, so file uploads use XMLHttpRequest
export function postFormProgress<T>(
  path: string,
  form: FormData,
  onProgress: (percent: number) => void,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', `${BASE}${path}`)
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
    // A dropped network ends up here, which the form treats as "Try again"
    xhr.onerror = () => reject(new TypeError('network'))
    xhr.ontimeout = () => reject(new TypeError('timeout'))
    xhr.send(form)
  })
}