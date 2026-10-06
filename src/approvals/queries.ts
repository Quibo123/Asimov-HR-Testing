import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
import type { Approval } from './types'

const key = ['approvals'] as const

export const useApprovals = () =>
  useQuery({ queryKey: key, queryFn: () => api<Approval[]>('/approvals') })

type Decision = { id: string; kind: 'approve' | 'reject'; reason?: string }

export function useDecide() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (d: Decision) =>
      api(`/approvals/${d.id}/${d.kind}`, {
        method: 'POST',
        body: d.reason === undefined ? undefined : JSON.stringify({ reason: d.reason }),
      }),
    onMutate: async d => {
      await qc.cancelQueries({ queryKey: key })
      const previous = qc.getQueryData<Approval[]>(key)
      qc.setQueryData<Approval[]>(key, old => (old ?? []).filter(a => a.id !== d.id))
      return { previous }
    },
    onError: (_error, _decision, context) => {
      if (context) qc.setQueryData(key, context.previous)
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: key })
    },
  })
}