---
description: Add a new screen to the web app
---

Add a new screen: $ARGUMENTS

Follow these steps:

1. Read CLAUDE.md and look at an existing screen in apps/web
   for conventions.

2. Use i18n keys for every user-facing string.
   No hardcoded text.

3. Show dates and times converted from UTC to the user's
   local time at the display layer only.

4. Call the API through the existing client and include
   the X-Tenant-ID header.

5. Handle loading, empty, and error states.

6. Run the tests and report the result.