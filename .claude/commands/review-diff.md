---
description: Review the current git diff against project rules
---

Review the current changes (`git diff` and `git diff --staged`).

Check each item and report pass or fail with file and line:

1. Every query on a tenant-owned table uses forTenant(tenantId).

2. No tenant ID is read from a request body.

3. Timestamps are handled in UTC.

4. No committed migration was edited.
   New changes are new migrations.

5. No hardcoded user-facing strings.
   i18n keys are used.

6. Ledger entries are never updated or deleted.

7. No secrets or .env values appear in the diff.

8. Tests exist for new behavior and pass.

End with a short list of required fixes,
most serious first.