import type { OwnerRole } from './types'

export type BoardTask = {
  id: string
  title: string
  ownerRole: OwnerRole
  dueDate: string // yyyy-MM-dd
  status: 'todo' | 'done'
}

export type BoardJoiner = {
  id: string
  name: string
  department: string
  location: string
  joiningDate: string // yyyy-MM-dd
  templateName: string
  tasks: BoardTask[]
}

// asOf is today's date, from the server, so the board and the API always agree
export type BoardData = { asOf: string; joiners: BoardJoiner[] }

export type Blocker = {
  taskId: string
  title: string
  ownerRole: OwnerRole
  kind: 'overdue' | 'today'
  days: number
}

export type BoardRow = {
  joiner: BoardJoiner
  done: number
  total: number
  percent: number
  blockers: Blocker[]
  daysToJoin: number
}