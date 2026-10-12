import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
import type { OnboardOptions, OnboardSummary, OnboardTemplate } from './types'
import type { toPayload } from './logic'

export const useOnboardTemplates = () =>
  useQuery({ queryKey: ['onboard-templates'], queryFn: () => api<OnboardSummary[]>('/onboard/templates') })

export const useOnboardOptions = () =>
  useQuery({ queryKey: ['onboard-options'], queryFn: () => api<OnboardOptions>('/onboard/options') })

// gcTime 0: the editor always starts from fresh data, never from an old copy.
// enabled: a new template has no id, so nothing is fetched for it.
export const useOnboardTemplate = (id: string) =>
  useQuery({
    queryKey: ['onboard-template', id],
    queryFn: () => api<OnboardTemplate>(`/onboard/templates/${id}`),
    gcTime: 0,
    enabled: id !== '',
  })

export function useSaveTemplate(id?: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: ReturnType<typeof toPayload>) =>
      id
        ? api(`/onboard/templates/${id}`, { method: 'PUT', body: JSON.stringify(payload) })
        : api('/onboard/templates', { method: 'POST', body: JSON.stringify(payload) }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['onboard-templates'] })
      void qc.invalidateQueries({ queryKey: ['onboard-template'] })
    },
  })
}