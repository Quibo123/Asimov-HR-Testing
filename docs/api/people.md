# People core API

All routes need `Authorization: Bearer <token>` (and `X-Tenant-ID` for users in several tenants).

## Who can do what
- **HR** (roles OWNER and ADMIN for now; permission `core.employees.manage`): create and change employees, locations,
  departments and designations; see every employee.
- **Sensitive details** (permission `core.employees.sensitive`, HR only): bank and ID numbers.
- **Manager** (anyone who has direct reports): sees their own record and their direct reports, read only.
- **Employee**: sees only their own record.
A person who is not allowed to see an employee gets 404, the same as if the employee did not exist.

## Locations, departments, designations
`GET /core/locations`, `/core/departments`, `/core/designations` (everyone) return `{ "items": [...] }`.
HR: `POST` (201), `PATCH /:id`, `DELETE /:id` (204; 409 if employees still use it).

Location body: `{ "name": "Chennai", "country": "IN", "timeZone": "Asia/Kolkata", "weekendDays": [7] }`
- `timeZone` is required and must be a valid IANA name, otherwise 400.
- `weekendDays`: 1 = Monday ... 7 = Sunday, one to three days.
Department and designation body: `{ "name": "Finance" }`.

## Employees
- `GET /core/employees?q=&status=&locationId=&departmentId=&limit=50&cursor=` -> `{ "items": [...], "nextCursor": "..." | null }`
- `GET /core/employees/me`, `GET /core/employees/:id`
- `POST /core/employees` (HR, 201), `PATCH /core/employees/:id` (HR). There is no delete: set `status` to `LEFT`.

Create body:
```json
{ "code": "E-1001", "name": "Asha K", "email": "asha@example.com", "phone": "+91 98765 43210",
  "locationId": "uuid", "departmentId": "uuid", "designationId": "uuid", "managerId": "uuid",
  "joiningDate": "2026-10-11", "status": "ONBOARDING", "customFields": { "shirtSize": "M" } }
```
- `status`: `ONBOARDING` (default), `ACTIVE`, `NOTICE`, `LEFT`.
- `userId` links the person to a sign-in account. If it is left out, the employee is linked to the member
  with the same email, when there is one.
- On `PATCH`, a missing field is left alone and `null` clears an optional field. `customFields` is replaced as a whole.
- Custom fields are flat (text, number, true/false). Bank and ID data is refused there.
- Errors: 400 (invalid input, unknown location/department/manager, manager loop), 403 (not HR), 404, 409 (code or email already used).

## Sensitive details (HR only)
- `GET /core/employees/:id/sensitive` -> `{ "employeeId", "bankAccountHolder", "bankAccountNumber", "bankCode", "governmentIdType", "governmentIdNumber", "taxIdNumber", "updatedAt" }`
  Every read is written to the audit log (action `employee.sensitive_read`). Responses are `no-store`.
- `PUT /core/employees/:id/sensitive` with any of those fields (null clears one) -> `{ "employeeId", "fieldsChanged": [...] }`

## Events (for other modules, server code only)
`employee.created` is published exactly once per employee, and `employee.updated` when something really changed.
Events never contain bank or ID details. Delivery is at least once: use the event `id` to skip a repeat.
```json
{ "id": "uuid", "type": "employee.updated", "tenantId": "uuid", "employeeId": "uuid",
  "occurredAt": "2026-10-11T10:00:00.000Z",
  "data": { "employee": { "...": "..." }, "changes": { "locationId": { "from": "uuid", "to": "uuid" } } } }
```
Register a listener in the worker process: `onEmployeeEvent("employee.created", async (event) => { ... })`.