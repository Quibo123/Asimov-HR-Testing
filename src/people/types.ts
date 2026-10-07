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