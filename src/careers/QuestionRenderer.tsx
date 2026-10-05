import { Input, Radio, RadioGroup, Textarea } from '@heroui/react'
import { useTranslation } from 'react-i18next'
import type { Answer, Question } from './types'

type Props = {
  question: Question
  value: Answer
  error?: string
  onChange: (value: Answer) => void
}

export default function QuestionRenderer({ question: q, value, error, onChange }: Props) {
  const { t } = useTranslation('careers')
  const label = q.required ? `${q.label} *` : q.label

  switch (q.type) {
    case 'text':
      return (
        <Textarea
          label={label}
          value={typeof value === 'string' ? value : ''}
          onValueChange={onChange}
          maxLength={q.maxLength}
          isInvalid={!!error}
          errorMessage={error}
        />
      )

    case 'number':
      return (
        <Input
          type="number"
          inputMode="decimal"
          label={label}
          value={value === undefined ? '' : String(value)}
          onValueChange={onChange}
          min={q.min}
          max={q.max}
          isInvalid={!!error}
          errorMessage={error}
        />
      )

    case 'choice':
      return (
        <RadioGroup
          label={label}
          value={typeof value === 'string' ? value : ''}
          onValueChange={onChange}
          isInvalid={!!error}
          errorMessage={error}
        >
          {q.options.map(o => (
            <Radio key={o} value={o}>{o}</Radio>
          ))}
        </RadioGroup>
      )

    case 'yesno':
      return (
        <RadioGroup
          label={label}
          orientation="horizontal"
          value={value === true ? 'yes' : value === false ? 'no' : ''}
          onValueChange={v => onChange(v === 'yes')}
          isInvalid={!!error}
          errorMessage={error}
        >
          <Radio value="yes">{t('apply.yes')}</Radio>
          <Radio value="no">{t('apply.no')}</Radio>
        </RadioGroup>
      )

    case 'rating': {
      const max = q.max ?? 5
      return (
        <fieldset className="flex flex-col gap-2">
          <legend className="text-sm">{label}</legend>
          <div className="flex flex-wrap gap-2">
            {Array.from({ length: max }, (_, i) => i + 1).map(n => (
              <button
                key={n}
                type="button"
                aria-pressed={value === n}
                aria-label={t('apply.ratingLabel', { n, max })}
                onClick={() => onChange(n)}
                className={`h-10 w-10 rounded-lg border ${
  value === n ? 'bg-(--brand) text-white' : ''
}`}
              >
                {n}
              </button>
            ))}
          </div>
          {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
        </fieldset>
      )
    }
  }
}