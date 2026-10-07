import { Fragment } from 'react'
import { useTranslation } from 'react-i18next'
import { EmptyState, ErrorState, SkeletonList } from '../components/states'
import { formatInZone, zoneLabel } from '../lib/time'
import { localZone } from '../ats/logic'
import { useActivity, useSensitive } from './profileQueries'
import type { Profile } from './types'

type Row = { label: string; value: string }

function Fields({ rows }: { rows: Row[] }) {
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2">
      {rows.map(r => (
        <Fragment key={r.label}>
          <dt className="opacity-70">{r.label}</dt>
          <dd className="min-w-0 wrap-break-word">{r.value}</dd>
        </Fragment>
      ))}
    </dl>
  )
}

// Dates without a time (a joining date) are shown as written, not shifted by a time zone
const day = (d: string) => formatInZone(`${d}T00:00:00Z`, 'UTC', 'd MMM yyyy')

export function OverviewTab({ e }: { e: Profile }) {
  const { t } = useTranslation('people')
  const f = (k: string) => t(`profile.fields.${k}`)
  return (
    <Fields
      rows={[
        { label: f('code'), value: e.code },
        { label: f('status'), value: t(`directory.status.${e.status}`) },
        { label: f('email'), value: e.email },
        { label: f('phone'), value: e.phone },
        { label: f('department'), value: e.department },
        { label: f('location'), value: e.location },
      ]}
    />
  )
}

export function JobTab({ e }: { e: Profile }) {
  const { t } = useTranslation('people')
  const f = (k: string) => t(`profile.fields.${k}`)
  const rows: Row[] = [
    { label: f('designation'), value: e.designation },
    { label: f('department'), value: e.department },
    { label: f('location'), value: e.location },
    { label: f('manager'), value: e.manager },
    { label: f('joiningDate'), value: day(e.joiningDate) },
    { label: f('employmentType'), value: e.employmentType },
    { label: f('grade'), value: e.grade },
  ]
  if (e.exitDate) rows.push({ label: f('exitDate'), value: day(e.exitDate) })
  return <Fields rows={rows} />
}

export function ActivityTab({ employeeId }: { employeeId: string }) {
  const { t } = useTranslation('people')
  const { data, isPending, isError, refetch } = useActivity(employeeId)
  const zone = localZone()
  const when = (iso: string) => `${formatInZone(iso, zone, 'd MMM yyyy, HH:mm')} ${zoneLabel(zone)}`

  if (isPending) return <SkeletonList rows={4} height="h-16" />
  if (isError) return <ErrorState message={t('profile.activity.error')} onRetry={() => void refetch()} />
  if (data.length === 0) return <EmptyState message={t('profile.activity.empty')} />

  return (
    <ol className="flex flex-col gap-3 border-l-2 pl-4">
      {data.map(a => (
        <li key={a.id}>
          <p className="font-medium">
            {t(`profile.activity.actions.${a.action}`, { defaultValue: a.action })}
          </p>
          {a.detail && <p className="text-sm wrap-break-word">{a.detail}</p>}
          <p className="text-sm opacity-70">{t('profile.activity.byWhen', { who: a.by, when: when(a.at) })}</p>
        </li>
      ))}
    </ol>
  )
}

export function SensitiveTab({ employeeId }: { employeeId: string }) {
  const { t } = useTranslation('people')
  const { data, isPending, isError, refetch } = useSensitive(employeeId)
  const f = (k: string) => t(`profile.fields.${k}`)

  if (isPending) return <SkeletonList rows={3} height="h-12" />
  if (isError) return <ErrorState message={t('profile.sensitive.error')} onRetry={() => void refetch()} />

  const c = data.emergencyContact
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm opacity-80">{t('profile.sensitive.note')}</p>
      <Fields
        rows={[
          { label: f('dateOfBirth'), value: day(data.dateOfBirth) },
          { label: f('personalEmail'), value: data.personalEmail },
          {
            label: f('emergencyContact'),
            value: t('profile.sensitive.emergency', { name: c.name, relation: c.relation, phone: c.phone }),
          },
          { label: f('bankAccount'), value: t('profile.sensitive.bank', { last4: data.bankAccountLast4 }) },
          { label: f('salaryBand'), value: data.salaryBand },
        ]}
      />
    </div>
  )
}