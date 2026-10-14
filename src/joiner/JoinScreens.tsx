import { useTranslation } from 'react-i18next'
import { Button } from '@heroui/react'
import { CheckCircle2 } from 'lucide-react'
import { dayLabel } from '../lib/dayLabel'
import { doneCount, estimateMinutes } from './logic'
import { useScreenFocus } from './useScreenFocus'
import type { JoinerView } from './types'

const big = 'min-h-14 w-full text-lg'
const tick = 'text-green-700 dark:text-green-400'

export function Welcome({ view, onStart }: { view: JoinerView; onStart: () => void }) {
  const { t } = useTranslation('joiner')
  const title = t('welcome.title', { name: view.name })
  const h1 = useScreenFocus<HTMLHeadingElement>(title)
  const total = view.tasks.length
  const done = doneCount(view.tasks)
  const remaining = view.tasks.filter(k => k.status === 'todo')

  return (
    <div className="flex flex-col gap-4">
      <h1 ref={h1} tabIndex={-1} className="text-2xl font-semibold wrap-break-word outline-none">{title}</h1>
      <p>{t('welcome.joining', { date: dayLabel(view.joiningDate) })}</p>
      <p className="text-xl font-semibold">
        {t('welcome.steps', { count: remaining.length, minutes: estimateMinutes(remaining) })}
      </p>
      {done > 0 && <p>{t('welcome.progress', { done, total })}</p>}
      <p className="text-base opacity-80">{t('welcome.note')}</p>
      <Button color="primary" className={big} onPress={onStart}>
        {done > 0 ? t('welcome.continue') : t('welcome.start')}
      </Button>
    </div>
  )
}

export function Saved({ title, last, onNext }: { title: string; last: boolean; onNext: () => void }) {
  const { t } = useTranslation('joiner')
  const heading = t('saved.title')
  const h1 = useScreenFocus<HTMLHeadingElement>(heading)
  return (
    <div role="status" className="flex flex-col items-center gap-4 py-6 text-center">
      <CheckCircle2 size={64} aria-hidden="true" className={tick} />
      <h1 ref={h1} tabIndex={-1} className="text-3xl font-semibold outline-none">{heading}</h1>
      <p className="wrap-break-word">{t('saved.done', { title })}</p>
      <Button color="primary" className={big} onPress={onNext}>
        {last ? t('saved.finish') : t('saved.next')}
      </Button>
    </div>
  )
}

export function Finished({ view }: { view: JoinerView }) {
  const { t } = useTranslation('joiner')
  const heading = t('finished.title')
  const h1 = useScreenFocus<HTMLHeadingElement>(heading)
  return (
    <div role="status" className="flex flex-col items-center gap-4 py-6 text-center">
      <CheckCircle2 size={64} aria-hidden="true" className={tick} />
      <h1 ref={h1} tabIndex={-1} className="text-3xl font-semibold outline-none">{heading}</h1>
      <p className="wrap-break-word">{t('finished.text', { name: view.name })}</p>
      <p>{t('finished.joining', { date: dayLabel(view.joiningDate) })}</p>
    </div>
  )
}

// A joiner who has no steps of their own is not "all done", there is just nothing yet
export function NoSteps({ view }: { view: JoinerView }) {
  const { t } = useTranslation('joiner')
  const heading = t('empty.title')
  const h1 = useScreenFocus<HTMLHeadingElement>(heading)
  return (
    <div className="flex flex-col gap-4 py-6">
      <h1 ref={h1} tabIndex={-1} className="text-2xl font-semibold outline-none">{heading}</h1>
      <p className="wrap-break-word">{t('empty.text', { name: view.name })}</p>
    </div>
  )
}