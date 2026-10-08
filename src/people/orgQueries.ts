import { useQuery } from '@tanstack/react-query'
import { api } from '../lib/api'
import type { OrgPerson } from './types'

export const useOrg = () => useQuery({ queryKey: ['org'], queryFn: () => api<OrgPerson[]>('/people/org') })