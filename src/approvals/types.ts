export type ApprovalDetail = { label: string; value: string }

export type Approval = {
  id: string
  type: string
  title: string
  requester: string
  requestedAt: string
  balance?: ApprovalDetail
  details: ApprovalDetail[]
}