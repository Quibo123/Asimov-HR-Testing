import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { api } from '../lib/api'
import { toApiParams, type DirectoryQuery } from './logic'
import type { DirectoryResult } from './types'

export const useDirectory = (query: DirectoryQuery) =>
  useQuery({
    queryKey: ['directory', query],
    queryFn: () => api<DirectoryResult>(`/people/directory?${toApiParams(query)}`),
    placeholderData: keepPreviousData,
  })