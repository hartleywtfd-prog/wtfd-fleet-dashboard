# Gear Inspection Email Fix — 2026-08-11

This build fixes two separate issues:

1. Helmet/other PPE inspection emails
   - The Google Apps Script allows only Subcategory = Coat or Pants.
   - The new Worker endpoint also hard-filters to Coat/Pants, providing a second safety layer.

2. Cloudflare "Too many subrequests by single Worker invocation" error
   - The email job no longer calls the full /preview-turnout-gear endpoint.
   - It calls /preview-turnout-gear-inspections, which reads only the Asset Management dynamic view.
   - It intentionally skips the item catalog, extended-properties, and custom-field lookups that are needed by the dashboard but not by the email job.

Deployment:
1. Deploy this Cloudflare Worker build using the existing wtfd-operative-preview configuration.
2. In Google Apps Script, replace the current code with:
   apps-script/WTFD_Turnout_Gear_Notifications_INSPECTION_ONLY.gs
3. Run previewGearDueNotifications().
4. Confirm the Import sheet shows only Coat/Pants rows as threshold-eligible.
5. Do not run sendGearDueNotifications() until the preview looks correct.

No write operations to OperativeIQ are added by this build.


## V3 crew-email synchronization fix
- `/preview-crew-emails` now treats blank/unknown OperativeIQ crew status as eligible and excludes only explicitly inactive values.
- Every preview and scheduled gear-email run now refreshes blank Email Reference list addresses from OperativeIQ before recipient matching.
- Existing nonblank addresses remain preserved.
- This fixes valid active members who exist in OperativeIQ with email addresses but were previously omitted by the status filter.
