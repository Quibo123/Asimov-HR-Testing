export type CandidateStatus =
  | 'new' | 'verified' | 'shortlisted' | 'interview' | 'offer' | 'hired' | 'rejected'

export type CandidateSummary = {
  id: string
  name: string
  jobId: string
  jobTitle: string
  score: number
  mustHaveFailed: boolean
  status: CandidateStatus
  appliedAt: string
}

export type Adjustment = { by: string; at: string; reason: string }

export type BreakdownItem = {
  questionId: string
  label: string
  answer: string | null
  weight: number
  points: number
  originalPoints: number
  mustHave: boolean
  mustHaveMet: boolean
  adjustment?: Adjustment
}

export type HistoryEntry = {
  id: string
  status: CandidateStatus
  by: string
  at: string
  reason?: string
}

export type Note = { id: string; by: string; at: string; text: string; rating: number | null }

export type Hire = { joiningDate: string; location: string }

export type CandidateDetail = CandidateSummary & {
  resumeUrl: string
  verifiedBy: string | null
  verifiedAt: string | null
  breakdown: BreakdownItem[]
  history: HistoryEntry[]
  notes: Note[]
  hire: Hire | null
}