import { useMutation, useQuery } from '@tanstack/react-query'
import { getPublic, postFormProgress, postJson } from '../lib/publicApi'
import type { JoinerView } from './types'

export const joinerKey = (token: string) => ['joiner', token] as const

export const useJoiner = (token: string) =>
  useQuery({ queryKey: joinerKey(token), queryFn: () => getPublic<JoinerView>(`/joiner/${token}`) })

type Send = { taskId: string; note: string }

export const useAcknowledge = (token: string) =>
  useMutation({
    mutationFn: (v: Send) =>
      postJson<JoinerView>(`/joiner/${token}/tasks/${v.taskId}/acknowledge`, { note: v.note }),
  })

export const useUploadDocument = (token: string, onProgress: (percent: number) => void) =>
  useMutation({
    mutationFn: (v: Send & { file: File }) => {
      const form = new FormData()
      form.append('file', v.file)
      if (v.note) form.append('note', v.note)
      return postFormProgress<JoinerView>(`/joiner/${token}/tasks/${v.taskId}/document`, form, onProgress)
    },
  })