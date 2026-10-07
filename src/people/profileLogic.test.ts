import { describe, it, expect } from 'vitest'
import {
  MAX_DOCUMENT_BYTES, canEditDocuments, formatBytes, resolveTab, validateUpload, visibleTabs,
} from './profileLogic'

describe('tabs respect roles', () => {
  it('shows every tab to HR, Sensitive last', () => {
    for (const role of ['owner', 'admin'] as const) {
      expect(visibleTabs(role)).toEqual(['overview', 'job', 'documents', 'activity', 'sensitive'])
    }
  })
  it('shows everyone else only Overview and Job', () => {
    expect(visibleTabs('member')).toEqual(['overview', 'job'])
    expect(visibleTabs('interviewer')).toEqual(['overview', 'job'])
    expect(visibleTabs(undefined)).toEqual(['overview', 'job'])
  })
  it('the Sensitive tab does not exist for others', () => {
    expect(visibleTabs('member')).not.toContain('sensitive')
    expect(visibleTabs('interviewer')).not.toContain('sensitive')
  })
  it('falls back to Overview for a tab the role cannot see or an unknown one', () => {
    expect(resolveTab('sensitive', 'member')).toBe('overview')
    expect(resolveTab('documents', 'interviewer')).toBe('overview')
    expect(resolveTab('nonsense', 'owner')).toBe('overview')
    expect(resolveTab(null, 'owner')).toBe('overview')
    expect(resolveTab('sensitive', 'admin')).toBe('sensitive')
    expect(resolveTab('job', 'member')).toBe('job')
  })
})

describe('exited employees are read-only', () => {
  it('blocks document changes even for HR', () => {
    expect(canEditDocuments('owner', 'active')).toBe(true)
    expect(canEditDocuments('owner', 'on_leave')).toBe(true)
    expect(canEditDocuments('owner', 'exited')).toBe(false)
    expect(canEditDocuments('member', 'active')).toBe(false)
  })
})

describe('upload checks', () => {
  it('accepts normal documents', () => {
    expect(validateUpload({ name: 'offer.pdf', size: 1000 })).toBeNull()
    expect(validateUpload({ name: 'ID.JPG', size: 1000 })).toBeNull()
    expect(validateUpload({ name: 'contract.docx', size: MAX_DOCUMENT_BYTES })).toBeNull()
  })
  it('rejects other types and big files', () => {
    expect(validateUpload({ name: 'run.exe', size: 10 })).toBe('type')
    expect(validateUpload({ name: 'noextension', size: 10 })).toBe('type')
    expect(validateUpload({ name: 'big.pdf', size: MAX_DOCUMENT_BYTES + 1 })).toBe('size')
  })
  it('prints sizes people can read', () => {
    expect(formatBytes(500)).toBe('500 B')
    expect(formatBytes(2048)).toBe('2 KB')
    expect(formatBytes(5 * 1024 * 1024)).toBe('5.0 MB')
  })
})