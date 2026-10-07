import { can, type Role } from '../lib/permissions'
import type { EmployeeStatus } from './types'

export type ProfileTab = 'overview' | 'job' | 'documents' | 'activity' | 'sensitive'

// A tab the role may not see is simply not in this list, so it is never rendered
export function visibleTabs(role: Role | null | undefined): ProfileTab[] {
  const tabs: ProfileTab[] = ['overview', 'job']
  if (can(role, 'people.documents')) tabs.push('documents')
  if (can(role, 'people.activity')) tabs.push('activity')
  if (can(role, 'people.sensitive')) tabs.push('sensitive')
  return tabs
}

// An unknown tab, or one this role may not see, falls back to Overview
export function resolveTab(raw: string | null, role: Role | null | undefined): ProfileTab {
  return visibleTabs(role).find(t => t === raw) ?? 'overview'
}

export const isExited = (status: EmployeeStatus) => status === 'exited'

// Exited profiles are read-only, whatever the role
export const canEditDocuments = (role: Role | null | undefined, status: EmployeeStatus) =>
  can(role, 'people.documents.manage') && !isExited(status)

export const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024
const ALLOWED_EXTENSIONS = ['pdf', 'png', 'jpg', 'jpeg', 'docx']

export type UploadError = 'type' | 'size'

export function validateUpload(file: { name: string; size: number }): UploadError | null {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
  if (!ALLOWED_EXTENSIONS.includes(ext)) return 'type'
  if (file.size > MAX_DOCUMENT_BYTES) return 'size'
  return null
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}