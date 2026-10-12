export type OwnerRole = 'hr' | 'manager' | 'it' | 'finance' | 'employee'
export type Requirement = 'document' | 'acknowledgement'

export type OnboardTask = {
  id: string
  title: string
  ownerRole: OwnerRole
  dueOffset: number // days from the joining date. Negative is before.
  requirement: Requirement
}

export type OnboardTemplate = {
  id?: string
  name: string
  isDefault: boolean
  departments: string[]
  locations: string[]
  tasks: OnboardTask[]
  runningCount: number
}

export type OnboardSummary = {
  id: string
  name: string
  isDefault: boolean
  taskCount: number
  departments: string[]
  locations: string[]
  runningCount: number
}

export type OnboardOptions = { departments: string[]; locations: string[] }

// While typing, the offset is text, so "-" and "" are allowed on the way to a number
export type TaskDraft = {
  id: string
  title: string
  ownerRole: OwnerRole
  offset: string
  requirement: Requirement
}

export type Draft = {
  name: string
  isDefault: boolean
  departments: string[]
  locations: string[]
  tasks: TaskDraft[]
}