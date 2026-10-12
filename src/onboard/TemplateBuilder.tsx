import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Button, Checkbox, CheckboxGroup, Input, Radio, RadioGroup, Switch } from '@heroui/react'
import {
  MAX_OFFSET, MIN_OFFSET, OWNER_ROLES, REQUIREMENTS, dueLabel, fromTemplate, newTask, parseOffset,
  toPayload, validateDraft,
} from './logic'
import { useOnboardTemplates, useSaveTemplate } from './queries'
import type { Draft, OnboardOptions, OnboardTemplate, OwnerRole, Requirement, TaskDraft } from './types'

type Props = { initial: OnboardTemplate; options: OnboardOptions }

const selectClass = 'h-11 rounded-lg border bg-transparent px-2'

export default function TemplateBuilder({ initial, options }: Props) {
  const { t } = useTranslation('onboard')
  const navigate = useNavigate()
  const save = useSaveTemplate(initial.id)
  const { data: all } = useOnboardTemplates()

  const [draft, setDraft] = useState<Draft>(() => fromTemplate(initial))
  const issues = validateDraft(draft)

  const isEdit = initial.id !== undefined
  const lockedDefault = isEdit && initial.isDefault
  const otherDefault = all?.find(s => s.isDefault && s.id !== initial.id)

  const patch = (p: Partial<Draft>) => setDraft(d => ({ ...d, ...p }))
  const patchTask = (id: string, p: Partial<TaskDraft>) =>
    setDraft(d => ({ ...d, tasks: d.tasks.map(k => (k.id === id ? { ...k, ...p } : k)) }))

  function handleSave() {
    if (issues.length > 0) return
    // Running onboardings keep their tasks, so say so before saving
    if (initial.runningCount > 0 && !window.confirm(t('builder.confirmSave'))) return
    save.mutate(toPayload(draft), { onSuccess: () => navigate('/onboard/templates') })
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
      <Link to="/onboard/templates" className="inline-flex min-h-11 items-center text-sm underline">
        {t('builder.back')}
      </Link>
      <h1 className="text-xl font-semibold">{isEdit ? t('builder.editTitle') : t('builder.newTitle')}</h1>

      {initial.runningCount > 0 && (
        <p role="note" className="rounded-lg border-2 border-(--brand) p-3">
          {t('builder.running', { count: initial.runningCount })}
        </p>
      )}

      <Input label={t('builder.name')} value={draft.name} onValueChange={v => patch({ name: v })} isRequired />

      <div className="flex flex-col gap-1">
        <Switch isSelected={draft.isDefault} isDisabled={lockedDefault} onValueChange={v => patch({ isDefault: v })}>
          {t('builder.default')}
        </Switch>
        <p className="text-sm opacity-80">{lockedDefault ? t('builder.defaultLocked') : t('builder.defaultNote')}</p>
        {draft.isDefault && !initial.isDefault && otherDefault && (
          <p role="note" className="text-sm font-medium">{t('builder.defaultReplaces', { name: otherDefault.name })}</p>
        )}
      </div>

      <section aria-label={t('builder.matchTitle')} className="flex flex-col gap-3 rounded-lg border p-4">
        <h2 className="text-lg font-semibold">{t('builder.matchTitle')}</h2>
        <p className="text-sm opacity-80">{t('builder.matchHelp')}</p>
        <CheckboxGroup
          label={t('builder.departments')}
          value={draft.departments}
          onValueChange={v => patch({ departments: v })}
        >
          {options.departments.map(d => (
            <Checkbox key={d} value={d} className="min-h-11">{d}</Checkbox>
          ))}
        </CheckboxGroup>
        <CheckboxGroup
          label={t('builder.locations')}
          value={draft.locations}
          onValueChange={v => patch({ locations: v })}
        >
          {options.locations.map(l => (
            <Checkbox key={l} value={l} className="min-h-11">{l}</Checkbox>
          ))}
        </CheckboxGroup>
      </section>

      <section aria-label={t('builder.tasksTitle')} className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">{t('builder.tasksTitle')}</h2>
        {draft.tasks.length === 0 && <p>{t('builder.noTasks')}</p>}

        {draft.tasks.map((k, i) => {
          const n = parseOffset(k.offset)
          const due = n === null ? null : dueLabel(n)
          return (
            <fieldset key={k.id} className="flex flex-col gap-3 rounded-lg border p-4">
              <legend className="px-1 text-sm font-semibold">{t('builder.task', { n: i + 1 })}</legend>

              <Input label={t('builder.taskTitle')} value={k.title} onValueChange={v => patchTask(k.id, { title: v })} />

              <div className="flex flex-wrap items-end gap-3">
                <label className="flex flex-col gap-1 text-sm">
                  {t('builder.ownerRole')}
                  <select
                    className={selectClass}
                    value={k.ownerRole}
                    onChange={e => patchTask(k.id, { ownerRole: e.target.value as OwnerRole })}
                  >
                    {OWNER_ROLES.map(r => (
                      <option key={r} value={r}>{t(`roles.${r}`)}</option>
                    ))}
                  </select>
                </label>

                <Input
                  label={t('builder.offset')}
                  className="w-56"
                  value={k.offset}
                  onValueChange={v => patchTask(k.id, { offset: v })}
                  isInvalid={n === null}
                  errorMessage={n === null ? t('builder.offsetInvalid', { min: MIN_OFFSET, max: MAX_OFFSET }) : undefined}
                />
              </div>

              <p className="text-sm opacity-80">
                {due ? t(due.key, { count: due.count }) : t('builder.offsetHelp')}
              </p>

              <RadioGroup
                label={t('builder.requirement')}
                orientation="horizontal"
                value={k.requirement}
                onValueChange={v => patchTask(k.id, { requirement: v as Requirement })}
              >
                {REQUIREMENTS.map(r => (
                  <Radio key={r} value={r} className="min-h-11">{t(`requirements.${r}`)}</Radio>
                ))}
              </RadioGroup>

              <Button
                color="danger"
                variant="flat"
                className="min-h-11 self-start"
                onPress={() => setDraft(d => ({ ...d, tasks: d.tasks.filter(x => x.id !== k.id) }))}
              >
                {t('builder.removeTask')}
              </Button>
            </fieldset>
          )
        })}

        <Button
          variant="bordered"
          className="min-h-11 self-start"
          onPress={() => setDraft(d => ({ ...d, tasks: [...d.tasks, newTask()] }))}
        >
          {t('builder.addTask')}
        </Button>
      </section>

      <div className="sticky bottom-0 flex flex-wrap items-center gap-3 border-t bg-(--surface) py-3">
        <Button
          color="primary"
          className="min-h-11"
          isDisabled={issues.length > 0 || save.isPending}
          isLoading={save.isPending}
          onPress={handleSave}
        >
          {t('builder.save')}
        </Button>
      </div>

      {issues.length > 0 && (
        <ul className="list-disc pl-5 text-sm">
          {issues.map((issue, idx) => (
            <li key={idx}>{t(issue.key, issue.values)}</li>
          ))}
        </ul>
      )}
      {save.isError && <p role="alert" className="text-red-600">{t('builder.saveError')}</p>}
    </div>
  )
}