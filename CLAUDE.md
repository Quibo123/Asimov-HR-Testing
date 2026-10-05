# Asimov: project rules

Monorepo: `apps/api` (Fastify + Prisma + Neon) and `apps/web`.

API code is organized by module under
`apps/api/src/modules/<name>/{routes,service,events}.ts`.

Cross-cutting code lives in `apps/api/src/platform/`.

## Rules

1. **Tenant filter.**
   Every query on a tenant-owned table must use
   `forTenant(tenantId)` from `src/platform/for-tenant.ts`.

   Never query without it.

   `tenantId` comes from `request.tenantId`,
   never from the request body.

2. **UTC.**
   Store and compute all timestamps in UTC.
   Convert to local time only at the UI edge.

3. **No edited migrations.**
   Never modify a migration that has been committed.
   Create a new migration for schema changes.

4. **i18n keys.**
   No hardcoded user-facing strings.
   Use translation keys.

5. **Ledger rule.**
   Ledger entries are append-only.
   Never update or delete one.

6. **Run tests before done.**
   Run the test suite and confirm it passes before
   saying a task is finished.