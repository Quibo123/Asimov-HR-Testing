import { useQuery } from '@tanstack/react-query'
import { api } from '../lib/api'
import type { BoardData } from './boardTypes'

export const useBoard = () => useQuery({ queryKey: ['onboard-board'], queryFn: () => api<BoardData>('/onboard/board') })