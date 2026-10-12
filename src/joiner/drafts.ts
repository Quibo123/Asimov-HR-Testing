const key = (token: string, taskId: string) => `joiner:${token}:${taskId}`

export function readNote(token: string, taskId: string): string {
  try {
    return sessionStorage.getItem(key(token, taskId)) ?? ''
  } catch {
    return '' // storage unavailable: the note is still kept while the page stays open
  }
}

export function writeNote(token: string, taskId: string, value: string) {
  try {
    if (value) sessionStorage.setItem(key(token, taskId), value)
    else sessionStorage.removeItem(key(token, taskId))
  } catch {
    // storage unavailable: nothing to do
  }
}