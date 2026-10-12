export type JoinerRequirement = 'document' | 'acknowledgement'

export type JoinerTask = {
  id: string
  title: string
  description: string
  requirement: JoinerRequirement
  status: 'todo' | 'done'
  dueDate: string // yyyy-MM-dd
}

export type JoinerView = {
  name: string
  joiningDate: string // yyyy-MM-dd
  tasks: JoinerTask[]
}