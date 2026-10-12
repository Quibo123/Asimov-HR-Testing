import { describe, it, expect } from 'vitest'
import {
  MAX_FILE_BYTES, doneCount, estimateMinutes, fileSizeProblem, fileTypeProblem, fitWithin, jpgName,
  nextTask, percentDone,
} from './logic'
import type { JoinerTask } from './types'

const task = (id: string, requirement: JoinerTask['requirement'], status: JoinerTask['status'] = 'todo'): JoinerTask => ({
  id, title: id, description: '', requirement, status, dueDate: '2026-10-12',
})

describe('steps', () => {
  const tasks = [task('a', 'document', 'done'), task('b', 'document'), task('c', 'acknowledgement')]
  it('finds the next step and counts the done ones', () => {
    expect(nextTask(tasks)?.id).toBe('b')
    expect(doneCount(tasks)).toBe(1)
    expect(percentDone(tasks)).toBe(33)
  })
  it('has no next step when everything is done', () => {
    expect(nextTask([task('a', 'document', 'done')])).toBeNull()
    expect(nextTask([])).toBeNull()
    expect(percentDone([])).toBe(0)
  })
})

describe('"about N minutes"', () => {
  it('adds 3 per document and 1 per acknowledgement, rounded up to 5', () => {
    const five = [
      task('1', 'document'), task('2', 'document'),
      task('3', 'acknowledgement'), task('4', 'acknowledgement'), task('5', 'acknowledgement'),
    ]
    expect(estimateMinutes(five)).toBe(10) // 9 minutes
  })
  it('is never below 5, and zero when there are no steps', () => {
    expect(estimateMinutes([task('1', 'acknowledgement')])).toBe(5)
    expect(estimateMinutes([])).toBe(0)
  })
})

describe('photo size', () => {
  it('shrinks big photos and keeps the shape', () => {
    expect(fitWithin(4000, 3000, 1600)).toEqual({ width: 1600, height: 1200 })
    expect(fitWithin(3000, 4000, 1600)).toEqual({ width: 1200, height: 1600 })
  })
  it('never enlarges a small photo', () => {
    expect(fitWithin(800, 600, 1600)).toEqual({ width: 800, height: 600 })
  })
  it('names the smaller file .jpg', () => {
    expect(jpgName('IMG_1.PNG')).toBe('IMG_1.jpg')
    expect(jpgName('noextension')).toBe('noextension.jpg')
    expect(jpgName('a.b.heic')).toBe('a.b.jpg')
  })
})

describe('file checks', () => {
  it('accepts photos and PDFs, even when the phone sends no type', () => {
    expect(fileTypeProblem({ name: 'id.jpg', type: 'image/jpeg' })).toBeNull()
    expect(fileTypeProblem({ name: 'scan.pdf', type: 'application/pdf' })).toBeNull()
    expect(fileTypeProblem({ name: 'IMG_0001.HEIC', type: '' })).toBeNull()
  })
  it('rejects other files', () => {
    expect(fileTypeProblem({ name: 'run.exe', type: 'application/x-msdownload' })).toBe('type')
    expect(fileTypeProblem({ name: 'notes.txt', type: 'text/plain' })).toBe('type')
  })
  it('limits the size', () => {
    expect(fileSizeProblem({ size: MAX_FILE_BYTES })).toBeNull()
    expect(fileSizeProblem({ size: MAX_FILE_BYTES + 1 })).toBe('size')
  })
})