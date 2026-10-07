import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
import type { ActivityEntry, DocumentLink, EmployeeDocument, Profile, Sensitive } from './types'

export const useProfile = (id: string) =>
  useQuery({ queryKey: ['profile', id], queryFn: () => api<Profile>(`/people/${id}`) })

// gcTime 0: sensitive data is dropped from memory as soon as the tab is left
export const useSensitive = (id: string) =>
  useQuery({
    queryKey: ['sensitive', id],
    queryFn: () => api<Sensitive>(`/people/${id}/sensitive`),
    gcTime: 0,
  })

export const useDocuments = (id: string) =>
  useQuery({ queryKey: ['documents', id], queryFn: () => api<EmployeeDocument[]>(`/people/${id}/documents`) })

export const useActivity = (id: string) =>
  useQuery({ queryKey: ['activity', id], queryFn: () => api<ActivityEntry[]>(`/people/${id}/activity`) })

// Uploads, deletes and opens all write to the audit log, so Activity is refreshed too
function useRefresh(id: string) {
  const qc = useQueryClient()
  return () => {
    void qc.invalidateQueries({ queryKey: ['documents', id] })
    void qc.invalidateQueries({ queryKey: ['activity', id] })
  }
}

export function useUploadDocument(id: string) {
  const refresh = useRefresh(id)
  return useMutation({
    mutationFn: (file: File) => {
      const form = new FormData()
      form.append('file', file)
      return api<EmployeeDocument>(`/people/${id}/documents`, { method: 'POST', body: form })
    },
    onSuccess: refresh,
  })
}

export function useDeleteDocument(id: string) {
  const refresh = useRefresh(id)
  return useMutation({
    mutationFn: (docId: string) => api<void>(`/people/${id}/documents/${docId}`, { method: 'DELETE' }),
    onSuccess: refresh,
  })
}

// Every click asks for a new link, which expires after about a minute
export function useOpenDocumentLink(id: string) {
  const refresh = useRefresh(id)
  return useMutation({
    mutationFn: (docId: string) =>
      api<DocumentLink>(`/people/${id}/documents/${docId}/link`, { method: 'POST' }),
    onSettled: refresh,
  })
}