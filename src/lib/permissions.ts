export type Role = 'owner' | 'admin' | 'member'

export type Permission =
  | 'users.view'
  | 'users.invite'
  | 'users.changeRole'
  | 'users.remove'

const PERMISSIONS: Record<Role, Permission[]> = {
  owner: ['users.view', 'users.invite', 'users.changeRole', 'users.remove'],
  admin: ['users.view', 'users.invite', 'users.changeRole', 'users.remove'],
  member: [],
}

export function can(role: Role | null | undefined, permission: Permission): boolean {
  if (!role) return false
  return PERMISSIONS[role].includes(permission)
}