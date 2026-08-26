WTFD Physical-Due FINAL Replacement

This package avoids manual editing of the large operative-preview.js files.

REPLACE these files in GitHub:
1. /operative-preview-shared.js
2. /workers/operative-preview-shared.js
3. /wrangler-operative-preview.jsonc

Do NOT edit operative-preview.js or workers/operative-preview.js.

What this replacement does:
- Intercepts /preview-physical-due before the large base Worker handles it.
- Implements the physical-due report directly without the bad turnoutItemRows reference.
- Keeps SYNC_ADMIN_TOKEN authorization in front of all physical-due responses.
- Uses one shared Cloudflare Cache API snapshot for 4 hours.
- Adds X-WTFD-Physical-Due-Cache: MISS/HIT.
- Historical ?at= requests bypass the shared cache.
- All non-physical-due routes continue through the existing Worker unchanged.
- Existing scheduled jobs are delegated unchanged.

The Apps Script trigger file you already committed can remain as-is.
After this deploys, run createFourHourTriggerForDueForPhysicalApi() once in Apps Script.

No Raspberry Pi restart is required.
