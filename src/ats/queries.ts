import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
import type { CandidateDetail, CandidateSummary } from './types'

const listKey = ['candidates'] as const
const detailKey = (id: string) => ['candidate', id] as const

export const useCandidates = () =>
  useQuery({ queryKey: listKey, queryFn: () => api<CandidateSummary[]>('/talently/candidates') })

export const useCandidate = (id: string) =>
  useQuery({ queryKey: detailKey(id), queryFn: () => api<CandidateDetail>(`/talently/candidates/${id}`) })

type AdjustInput = { questionId: string; points: number; reason: string }

// Every action returns the updated candidate. The panel updates at once,
// and the list is refreshed so its score, flag and status stay in sync.
export function useCandidateActions(id: string) {
  const qc = useQueryClient()
  const post = (action: string, body?: unknown) =>
    api<CandidateDetail>(`/talently/candidates/${id}/${action}`, {
      method: 'POST',
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  const onSuccess = (detail: CandidateDetail) => {
    qc.setQueryData(detailKey(id), detail)
    void qc.invalidateQueries({ queryKey: listKey })
  }

  return {
    verify: useMutation({ mutationFn: () => post('verify'), onSuccess }),
    adjust: useMutation({ mutationFn: (v: AdjustInput) => post('adjust', v), onSuccess }),
    shortlist: useMutation({ mutationFn: () => post('shortlist'), onSuccess }),
  }
}