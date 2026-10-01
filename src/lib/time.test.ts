import { describe, it, expect } from 'vitest'
import { formatInZone } from './time'

describe('formatInZone', () => {
  it('formats an IST time', () => {
    expect(
      formatInZone('2026-11-01T06:30:00Z', 'Asia/Kolkata', 'yyyy-MM-dd HH:mm')
    ).toBe('2026-11-01 12:00')
  })

  it('formats a Dubai time', () => {
    expect(
      formatInZone('2026-11-01T06:30:00Z', 'Asia/Dubai', 'yyyy-MM-dd HH:mm')
    ).toBe('2026-11-01 10:30')
  })

  it('handles US Pacific when daylight saving ends on 1 Nov 2026', () => {
    expect(
      formatInZone('2026-11-01T08:30:00Z', 'America/Los_Angeles', 'HH:mm zzz')
    ).toBe('01:30 PDT')
    expect(
      formatInZone('2026-11-01T09:30:00Z', 'America/Los_Angeles', 'HH:mm zzz')
    ).toBe('01:30 PST')
  })
})