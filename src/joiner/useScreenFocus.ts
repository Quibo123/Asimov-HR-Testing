import { useEffect, useRef } from 'react'

export function useScreenFocus<T extends HTMLElement>(title: string) {
  const ref = useRef<T>(null)
  useEffect(() => {
    window.scrollTo({ top: 0 })
    ref.current?.focus({ preventScroll: true })
    document.title = title
  }, [title])
  return ref
}