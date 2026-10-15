import { useMutation, useQuery } from '@tanstack/react-query'
import { api } from '../lib/api'
import type { Pending, Punch, TodayData } from './types'

export const todayKey = ['clock-today'] as const

export const useToday = () => useQuery({ queryKey: todayKey, queryFn: () => api<TodayData>('/time/today') })

// The same key goes out on every try of the same tap
export const usePunch = () =>
  useMutation({
    mutationFn: (p: Pending) =>
      api<Punch>('/time/punch', {
        method: 'POST',
        headers: { 'Idempotency-Key': p.key },
        body: JSON.stringify({ type: p.type, clientAt: p.tappedAt }),
      }),
  })