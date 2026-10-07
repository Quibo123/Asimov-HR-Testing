export type EmployeeStatus = 'active' | 'on_leave' | 'exited'

export type Employee = {
  id: string
  code: string
  name: string
  designation: string
  department: string
  location: string
  status: EmployeeStatus
}

export type DirectoryResult = {
  items: Employee[]
  total: number
  page: number
  pageSize: number
  facets: { locations: string[]; departments: string[] }
}

export type Profile = Employee & {
  email: string
  phone: string
  manager: string
  joiningDate: string // yyyy-MM-dd
  employmentType: string
  grade: string
  exitDate: string | null // yyyy-MM-dd
}

export type Sensitive = {
  dateOfBirth: string // yyyy-MM-dd
  personalEmail: string
  emergencyContact: { name: string; relation: string; phone: string }
  bankAccountLast4: string
  salaryBand: string
}

export type EmployeeDocument = {
  id: string
  name: string
  size: number
  uploadedBy: string
  uploadedAt: string
}

export type DocumentLink = { url: string; expiresAt: string }

export type ActivityEntry = {
  id: string
  at: string
  by: string
  action: string
  detail: string
}