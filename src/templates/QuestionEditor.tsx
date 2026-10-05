import { Button, Checkbox, Input, Switch } from '@heroui/react'
import { useTranslation } from 'react-i18next'
import type { QType, TemplateOption, TemplateQuestion } from './types'
import { clampInt, defaultRule, newOption, withType } from './logic'

const TYPES: QType[] = ['text', 'choice', 'yesno', 'number', 'rating']

type Props = {
  q: TemplateQuestion
  index: number
  count: number
  onChange: (q: TemplateQuestion) => void
  onRemove: () => void
  onMove: (dir: -1 | 1) => void
}

export default function QuestionEditor({ q, index, count, onChange, onRemove, onMove }: Props) {
  const { t } = useTranslation('templates')

  const patch = (p: Partial<TemplateQuestion>) => onChange({ ...q, ...p })
  const setOption = (id: string, p: Partial<TemplateOption>) =>
    patch({ options: q.options.map(o => (o.id === id ? { ...o, ...p } : o)) })
  const toggleMustHave = (on: boolean) =>
    patch(on ? { mustHave: true, rule: defaultRule(q) } : { mustHave: false, rule: undefined })

  const hasOptions = q.type === 'choice' || q.type === 'yesno'

  return (
    <fieldset className="flex flex-col gap-3 rounded-lg border p-4">
      <legend className="px-1 text-sm font-semibold">{t('question.title', { n: index + 1 })}</legend>

      <Input label={t('question.text')} value={q.label} onValueChange={v => patch({ label: v })} />

      <div className="flex flex-wrap items-end gap-3">
        <select
          aria-label={t('question.type')}
          className="h-14 rounded-lg border px-2 bg-transparent"
          value={q.type}
          onChange={e => onChange(withType(q, e.target.value as QType))}
        >
          {TYPES.map(ty => (
            <option key={ty} value={ty}>{t(`types.${ty}`)}</option>
          ))}
        </select>
        <Input
          type="number"
          label={t('question.weight')}
          className="w-28"
          value={String(q.weight)}
          onValueChange={v => patch({ weight: clampInt(v, 0, 100) })}
        />
        <Checkbox isSelected={q.required} onValueChange={v => patch({ required: v })}>
          {t('question.required')}
        </Checkbox>
      </div>

      {hasOptions && (
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium">{t('question.options')}</p>
          {q.options.map(o => (
            <div key={o.id} className="flex flex-wrap items-end gap-2">
              {q.type === 'choice' ? (
                <Input
                  label={t('question.optionLabel')}
                  className="flex-1 min-w-40"
                  value={o.label}
                  onValueChange={v => setOption(o.id, { label: v })}
                />
              ) : (
                <p className="flex-1 min-w-24">{t(`question.${o.id}`)}</p>
              )}
              <Input
                type="number"
                label={t('question.score')}
                className="w-28"
                value={String(o.scorePercent)}
                onValueChange={v => setOption(o.id, { scorePercent: clampInt(v, 0, 100) })}
              />
              {q.type === 'choice' && (
                <Button
                  size="sm"
                  variant="flat"
                  onPress={() => patch({ options: q.options.filter(x => x.id !== o.id) })}
                >
                  {t('question.removeOption')}
                </Button>
              )}
            </div>
          ))}
          {q.type === 'choice' && (
            <Button
              size="sm"
              variant="bordered"
              className="self-start"
              onPress={() => patch({ options: [...q.options, newOption()] })}
            >
              {t('question.addOption')}
            </Button>
          )}
        </div>
      )}

      <div className="flex flex-col gap-2">
        <Switch isSelected={q.mustHave} isDisabled={q.type === 'text'} onValueChange={toggleMustHave}>
          {t('question.mustHave')}
        </Switch>
        {q.type === 'text' && <p className="text-sm opacity-70">{t('question.ruleNone')}</p>}

        {q.mustHave && q.rule && (
          <div className="flex flex-wrap items-end gap-2">
            {q.rule.op === 'gte' ? (
              <Input
                type="number"
                className="w-52"
                label={q.type === 'choice' ? t('question.ruleScore') : t('question.ruleAtLeast')}
                value={String(q.rule.value)}
                onValueChange={v =>
                  patch({ rule: { op: 'gte', value: clampInt(v, 0, q.type === 'choice' ? 100 : 1000000) } })
                }
              />
            ) : (
              <select
                aria-label={t('question.ruleAnswer')}
                className="h-14 rounded-lg border px-2 bg-transparent"
                value={String(q.rule.value)}
                onChange={e => patch({ rule: { op: 'eq', value: e.target.value } })}
              >
                <option value="yes">{t('question.yes')}</option>
                <option value="no">{t('question.no')}</option>
              </select>
            )}
          </div>
        )}

        {q.mustHave && <p className="text-sm opacity-80">{t('question.mustHaveNote')}</p>}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="flat" isDisabled={index === 0} onPress={() => onMove(-1)}>
          {t('question.moveUp')}
        </Button>
        <Button size="sm" variant="flat" isDisabled={index === count - 1} onPress={() => onMove(1)}>
          {t('question.moveDown')}
        </Button>
        <Button size="sm" color="danger" variant="flat" onPress={onRemove}>
          {t('question.remove')}
        </Button>
      </div>
    </fieldset>
  )
}