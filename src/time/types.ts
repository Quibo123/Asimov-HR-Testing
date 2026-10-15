export type PunchType = 'in' | 'out'

export type Punch = { id: string; type: PunchType; at: string }

export type TodayData = {
  date: string // yyyy-MM-dd in the location's zone
  location: { name: string; timeZone: string }
  shift: { start: string; end: string } | null
  punches: Punch[]
}

// A tap that has not been confirmed yet
export type Pending = { key: string; type: PunchType; tappedAt: string }