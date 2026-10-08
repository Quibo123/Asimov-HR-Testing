import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
import type { ImportPreview, ImportResult } from './types'

function formOf(file: File) {
  const form = new FormData()
  form.append('file', file)
  return form
}

// Dry run: checks every row, saves nothing
export const usePreviewImport = () =>
  useMutation({
    mutationFn: (file: File) =>
      api<ImportPreview>('/people/import/preview', { method: 'POST', body: formOf(file) }),
  })

// Saves the ready rows
export function useCommitImport() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (file: File) => api<ImportResult>('/people/import', { method: 'POST', body: formOf(file) }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['directory'] })
      void qc.invalidateQueries({ queryKey: ['org'] })
    },
  })
}