import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@heroui/react'

export function Skeleton({ className = '' }: { className?: string }) {
  return <div aria-hidden="true" className={`animate-pulse rounded-lg bg-black/10 ${className}`} />
}

// Grey blocks while data loads. Screen readers hear "Loading...".
export function SkeletonList({ rows = 3, height = 'h-24' }: { rows?: number; height?: string }) {
  const { t } = useTranslation()
  return (
    <div role="status" aria-busy="true" className="flex flex-col gap-3">
      <span className="sr-only">{t('states.loading')}</span>
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className={`${height} w-full`} />
      ))}
    </div>
  )
}

export function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  const { t } = useTranslation()
  return (
    <div role="alert" className="flex flex-col items-start gap-3 rounded-lg border border-red-300 p-4">
      <p className="font-semibold">{t('states.errorTitle')}</p>
      <p className="wrap-break-word">{message}</p>
      <Button color="primary" className="min-h-11" onPress={onRetry}>
        {t('states.retry')}
      </Button>
    </div>
  )
}

export function EmptyState({ message, children }: { message: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-start gap-3 rounded-lg border border-dashed p-6">
      <p>{message}</p>
      {children}
    </div>
  )
}

// Shows the public careers address, with a copy button
export function ShareCareersLink() {
  const { t } = useTranslation()
  const [copied, setCopied] = useState(false)
  const url = `${window.location.origin}/careers`

  async function copy() {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
    } catch {
      setCopied(false) // the address stays visible, so it can be copied by hand
    }
  }

  return (
    <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center">
      <code className="wrap-break-word rounded border px-2 py-2 text-sm">{url}</code>
      <Button variant="bordered" className="min-h-11" onPress={() => void copy()}>
        {copied ? t('states.copied') : t('states.shareLink')}
      </Button>
    </div>
  )
}