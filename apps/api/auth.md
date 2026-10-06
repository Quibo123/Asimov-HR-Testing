# Auth and Invites API contract

Status: DRAFT, to be agreed with Rishi.

## Conventions

- Every request except /health and /public/* needs `Authorization: Bearer <supabase access token>`.
- Users in more than one tenant must also send `X-Tenant-ID: <tenant uuid>`. Users in exactly one tenant may omit it.
- The server never trusts X-Tenant-ID on its own. It is checked against Membership.

| Status | Meaning |
|---|---|
| 400 | Invalid input, or tenant choice required |
| 401 | Missing or invalid token |
| 403 | Not allowed (not in this tenant, or role too low) |
| 404 | Not found |
| 409 | Conflict (already a member, or invite already pending) |

## POST /invites

Create an invite. Role required: OWNER or ADMIN.

Request:

```json
{ "email": "new.user@example.com", "role": "MEMBER" }
```

Response 201:

```json
{
  "id": "uuid",
  "email": "new.user@example.com",
  "role": "MEMBER",
  "tenantId": "uuid",
  "status": "pending",
  "expiresAt": "2026-10-20T00:00:00Z"
}
```

## GET /invites

List pending invites for the current tenant. Role required: OWNER or ADMIN.

Response 200:

```json
{ "items": [ { "id": "uuid", "email": "...", "role": "MEMBER", "status": "pending", "expiresAt": "..." } ] }
```

## DELETE /invites/:id

Revoke a pending invite. Role required: OWNER or ADMIN. Response 204.

## POST /invites/accept

The invited user accepts. Needs a valid token. No X-Tenant-ID is needed because the invite carries the tenant.

Request:

```json
{ "inviteToken": "string" }
```

Response 200:

```json
{ "tenantId": "uuid", "role": "MEMBER" }
```

## Open questions for Rishi

- Do we need GET /me (user plus list of tenants) so the web app can show a tenant picker? It would need a tenant-less exception in the auth hook.
- Invite expiry: 7 days or 14?
- Can an ADMIN invite another ADMIN, or only OWNER?