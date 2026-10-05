export type CandidateStatus = 'new' | 'verified' | 'shortlisted'

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

export type CandidateDetail = CandidateSummary & {
  resumeUrl: string
  verifiedBy: string | null
  verifiedAt: string | null
  breakdown: BreakdownItem[]
}