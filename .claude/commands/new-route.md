---
description: Add a new API route to a module
---

Add a new route: $ARGUMENTS

Follow these steps:

1. Read CLAUDE.md and the target module's existing routes.ts,
   service.ts, and events.ts.

2. Define a Zod schema for request params, query, and body.

3. Put business logic in service.ts, not routes.ts.
   The service takes tenantId as an argument.

4. Every database query must use forTenant(tenantId).
   Take tenantId from request.tenantId.

5. Register the route in the module's routes.ts
   and confirm the module is registered in src/index.ts.

6. If something notable happens, emit an event defined in events.ts.

7. Add tests for:
   - happy path
   - validation failure
   - missing X-Tenant-ID (400)

8. Run the tests and report the result.
