# Physical Due — four-hour shared snapshot

Base reviewed: Fleet Dashboard main commit `7a5055f5745562c096f27d999923ee84ff3341af`.

This patch:

- fixes `/preview-physical-due` HTTP 500 caused by the undefined `turnoutItemRows` reference;
- keeps `SYNC_ADMIN_TOKEN` authentication in front of the cache;
- shares the normal `/preview-physical-due` response through Cloudflare Cache API for 4 hours;
- bypasses the cache for `/preview-physical-due?at=...` historical validation requests;
- returns `X-WTFD-Physical-Due-Cache: MISS` on the first load and `HIT` on reuse;
- changes the Due For Physical Google Apps Script import trigger from daily to every 4 hours;
- preserves the old `createDailyTriggerForDueForPhysicalApi()` setup name as a compatibility alias.

After deployment, run `createFourHourTriggerForDueForPhysicalApi()` once in the bound Apps Script project.
