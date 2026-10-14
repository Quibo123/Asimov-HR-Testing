import type { JoinerTask } from './types'

export const MAX_FILE_BYTES = 10 * 1024 * 1024
export const MAX_SIDE = 1600
export const JPEG_QUALITY = 0.7

const MINUTES = { document: 3, acknowledgement: 1 } as const

export const nextTask = (tasks: JoinerTask[]): JoinerTask | null =>
  tasks.find(t => t.status === 'todo') ?? null

export const doneCount = (tasks: JoinerTask[]) => tasks.filter(t => t.status === 'done').length

// A friendly "about N minutes": a total rounded up to the next 5, never less than 5
export function estimateMinutes(tasks: JoinerTask[]): number {
  if (tasks.length === 0) return 0
  const sum = tasks.reduce((s, t) => s + MINUTES[t.requirement], 0)
  return Math.max(5, Math.ceil(sum / 5) * 5)
}

export const percentDone = (tasks: JoinerTask[]) =>
  tasks.length === 0 ? 0 : Math.round((doneCount(tasks) / tasks.length) * 100)

// Shrinks to fit inside max x max. Never makes a picture bigger.
export function fitWithin(width: number, height: number, max: number) {
  const scale = Math.min(1, max / Math.max(width, height))
  return { width: Math.round(width * scale), height: Math.round(height * scale) }
}

// "IMG_1.PNG" becomes "IMG_1.jpg"
export const jpgName = (name: string) => `${name.replace(/\.[^.]*$/, '')}.jpg`

const OK_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'application/pdf']
const OK_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif', 'pdf']

export type FileProblem = 'type' | 'size'

// Some phones send no type for a photo, so the extension is checked too
export function fileTypeProblem(f: { name: string; type: string }): FileProblem | null {
  const ext = f.name.split('.').pop()?.toLowerCase() ?? ''
  return OK_TYPES.includes(f.type) || OK_EXTENSIONS.includes(ext) ? null : 'type'
}

// Checked after a photo has been made smaller
export const fileSizeProblem = (f: { size: number }): FileProblem | null =>
  f.size > MAX_FILE_BYTES ? 'size' : null


export type Failure = 'network' | 'gone' | 'rejected' | 'server'

// Decides what a failed send means, so the screen only offers "retry" when retrying can help
export function classifyFailure(err: unknown): Failure {
  if (err instanceof TypeError) return 'network' // a dropped connection
  const status =
    typeof err === 'object' && err !== null && 'status' in err ? Number((err as { status: unknown }).status) : 0
  if (status === 404 || status === 410) return 'gone'
  if (status === 409 || status === 413 || status === 415 || status === 422) return 'rejected'
  return 'server'
}

// ?theme=dark or ?theme=light wins. Otherwise the phone's own setting decides.
export function resolveDark(search: string, prefersDark: boolean): boolean {
  const theme = new URLSearchParams(search).get('theme')
  if (theme === 'dark') return true
  if (theme === 'light') return false
  return prefersDark
}