import type { Pending, Punch, PunchType } from './types'

export const nextType = (state: 'in' | 'out'): PunchType => (state === 'in' ? 'out' : 'in')

// Clocked in when the last punch of the day is an "in"
export function stateOf(punches: Punch[]): 'in' | 'out' {
  const last = [...punches].sort((a, b) => a.at.localeCompare(b.at)).at(-1)
  return last?.type === 'in' ? 'in' : 'out'
}

// A replayed punch has the same id, so it is never listed twice
export function addPunch(list: Punch[], punch: Punch): Punch[] {
  if (list.some(p => p.id === punch.id)) return list
  return [...list, punch].sort((a, b) => a.at.localeCompare(b.at))
}

// Works on an insecure address too (crypto.randomUUID needs https)
export function makeKey(): string {
  const c = globalThis.crypto
  if (typeof c?.randomUUID === 'function') return c.randomUUID()
  const bytes = new Uint8Array(16)
  c.getRandomValues(bytes)
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('')
}

// The first tap makes a key. A retry gets the SAME pending punch back, so the key never changes.
export function startOrResume(
  existing: Pending | null,
  type: PunchType,
  newKey: () => string,
  nowIso: string,
): Pending {
  return existing ?? { key: newKey(), type, tappedAt: nowIso }
}

export type PunchFailure = 'retry' | 'conflict' | 'refused'

// A dropped network, a timeout, "too many requests" and server errors can be retried with the same key.
// A 409 means the status already changed. Any other refusal will not work if sent again.
export function classifyPunchError(err: unknown): PunchFailure {
  if (err instanceof TypeError) return 'retry'
  const status =
    typeof err === 'object' && err !== null && 'status' in err ? Number((err as { status: unknown }).status) : 0
  if (status === 409) return 'conflict'
  if (status === 408 || status === 429 || status >= 500 || status === 0) return 'retry'
  return 'refused'
}

// Reads what was saved on the phone. Anything odd is ignored rather than trusted.
export function parsePending(raw: string | null): Pending | null {
  if (!raw) return null
  try {
    const v: unknown = JSON.parse(raw)
    if (typeof v === 'object' && v !== null) {
      const o = v as Record<string, unknown>
      if (typeof o.key === 'string' && o.key && (o.type === 'in' || o.type === 'out') && typeof o.tappedAt === 'string') {
        return { key: o.key, type: o.type, tappedAt: o.tappedAt }
      }
    }
  } catch {
    // not JSON
  }
  return null
}