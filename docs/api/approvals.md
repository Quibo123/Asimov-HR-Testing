# Approvals API

All routes need `Authorization: Bearer <token>` (and `X-Tenant-ID` for users in several tenants).
Any signed-in member may call them; who may decide a given request is checked by the server.

Requests are created by other modules in server code, never from the browser.

## Statuses
- Request: `PENDING`, `APPROVED`, `REJECTED`, `WITHDRAWN`
- Step: `WAITING`, `PENDING`, `APPROVED`, `REJECTED`, `CANCELLED`

## Rules
- A requester can never approve or reject their own request (403). They can withdraw it.
- Rejecting needs a `reason` (3 or more characters).
- Repeating the same decision returns the same result with `"repeated": true` and writes nothing.
  A conflicting decision on a finished request returns 409.
- Steps run in order. A rejection ends the request.
- If the approver is unavailable, or has not decided within the tenant's fallback time (default 48 hours),
  the step moves to the fallback approver, who is then the only one who can decide it.

## GET /approvals/pending
Steps waiting for me to decide.
`{ "items": [ { "requestId", "stepId", "stepPosition", "module", "type", "summary", "subjectEntity", "subjectId", "requesterId", "requesterEmail", "waitingSince", "escalated" } ] }`

## GET /approvals/requests?status=PENDING&limit=50
Requests I made, newest first: `{ "items": [ { "id", "status", "summary", "steps": [ ... ], ... } ] }`

## GET /approvals/requests/:id
One request with its steps. Only the requester and approvers can open it (404 otherwise).

## POST /approvals/requests/:id/decide
```json
{ "decision": "approve" }
{ "decision": "reject", "reason": "Not enough budget" }
```
Response 200: `{ "request": { ...with steps }, "repeated": false }`
Errors: 400 (reason missing), 403 (your own request, or not your step), 404, 409 (already decided).

## POST /approvals/requests/:id/withdraw
No body. Requester only, while pending. Response 200: `{ "request": { ... }, "repeated": false }`.
403 (not the requester), 409 (already decided).

## Event for modules: approval.decided
Sent once a request is APPROVED, REJECTED or WITHDRAWN, to the module that asked.
Delivery is at least once, so handle the same `requestId` twice safely.
```json
{ "requestId": "uuid", "tenantId": "uuid", "module": "time", "type": "leave",
  "subjectEntity": "LeaveRequest", "subjectId": "uuid", "requesterId": "uuid",
  "status": "APPROVED", "decidedAt": "2026-10-09T10:00:00.000Z" }
```
A module listens with `onApprovalDecided("time", async (event) => { ... })`.

## Tenant settings
- `approvals.fallbackHours` (number, default 48)
- `approvals.fallbackUserId` (user id; if unset, owners other than the requester are the fallback)