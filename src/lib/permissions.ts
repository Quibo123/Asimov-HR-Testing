export type Role = 'owner' | 'admin' | 'member' | 'interviewer'

export type Permission =
  | 'users.view'
  | 'users.invite'
  | 'users.changeRole'
  | 'users.remove'
  | 'pipeline.move'
  | 'pipeline.offer'
  | 'notes.add'
  | 'approvals.decide'
  | 'people.documents'
  | 'people.documents.manage'
  | 'people.activity'
  | 'people.sensitive'
  | 'people.import'

const MANAGER: Permission[] = [
  'users.view', 'users.invite', 'users.changeRole', 'users.remove',
  'pipeline.move', 'pipeline.offer', 'notes.add', 'approvals.decide',
  'people.documents', 'people.documents.manage', 'people.activity', 'people.sensitive',
  'people.import',
]

const PERMISSIONS: Record<Role, Permission[]> = {
  owner: MANAGER,
  admin: MANAGER,
  member: [],
  interviewer: ['notes.add'], // notes and ratings only
}

export function can(role: Role | null | undefined, permission: Permission): boolean {
  if (!role) return false
  return PERMISSIONS[role].includes(permission)
}