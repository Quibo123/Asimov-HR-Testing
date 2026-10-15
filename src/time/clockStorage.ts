import { parsePending } from './clockLogic'
import type { Pending } from './types'

const key = (userId: string) => `clock:pending:${userId}`

export function readPending(userId: string): Pending | null {
  try {
    return parsePending(localStorage.getItem(key(userId)))
  } catch {
    return null // storage unavailable
  }
}

export function writePending(userId: string, p: Pending) {
  try {
    localStorage.setItem(key(userId), JSON.stringify(p))
  } catch {
    // storage unavailable: the tap is still kept while the page stays open
  }
}

export function clearPending(userId: string) {
  try {
    localStorage.removeItem(key(userId))
  } catch {
    // nothing to do
  }
}