import { formatInZone } from './time'

// "2026-10-12" becomes "12 Oct 2026"
export const dayLabel = (d: string) => formatInZone(`${d}T00:00:00Z`, 'UTC', 'd MMM yyyy')