import { formatInTimeZone } from 'date-fns-tz'

export function formatInZone(utcIso: string, ianaZone: string, pattern: string): string {
  return formatInTimeZone(new Date(utcIso), ianaZone, pattern)
}

export function zoneLabel(ianaZone: string): string {
  const parts = new Intl.DateTimeFormat('en', {
    timeZone: ianaZone,
    timeZoneName: 'short',
  }).formatToParts(new Date())
  return parts.find(p => p.type === 'timeZoneName')?.value ?? ianaZone
}