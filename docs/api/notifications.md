# Notifications API

All routes need `Authorization: Bearer <token>` (and `X-Tenant-ID` for users in several tenants).
A user only ever sees their own notifications in the current tenant.

## GET /notifications?unread=true&limit=30
`{ "items": [ { "id", "type", "title", "body", "link", "readAt", "createdAt" } ], "unread": 3 }`
`link` is a path inside the app, like `/approvals/123`. Open it inside the current tenant.

## POST /notifications/:id/read
Marks one notification read and returns it. Repeating it is harmless. 404 if it is not yours.

## POST /notifications/read-all
`{ "updated": 3 }`

## Emails
Every notification is also sent by email, in the tenant's brand (logo, colour, sender name).
The button in the email opens `<app>/<link>?tenant=<tenantId>`. The frontend must read the `tenant`
query value, switch to that tenant, and then open the item.

## For modules: sending a notification (server code only)
```ts
await notify({
  eventId: `approval.decided:${event.requestId}`, // stable: the same event never notifies twice
  tenantId: event.tenantId,
  userId: event.requesterId,
  type: "approval.decided",
  data: { summary: "Leave request, 3 days", status: "approved" },
  link: `/approvals/${event.requestId}`,
});
```
- Only template types and their listed variables are allowed (see `templates.ts`).
- Salary, bank and ID details are refused and never sent. `notify()` throws in that case,
  so wrap it in try/catch and log.
- Add new kinds of notification by adding a template, never by passing free text.

## Tenant brand settings
`brand.logoUrl` (https image), `brand.colour` (like `#E4572E`), `brand.senderName`.
Missing or invalid values fall back to the tenant name and a default colour.