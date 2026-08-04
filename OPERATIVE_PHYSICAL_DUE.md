# Due For Physical API Migration

This update replaces the emailed `Due For Physical.xls` import with a protected,
read-only OperativeIQ API route:

- `/preview-physical-due`

The route reproduces the report named **Due For Physical Next 30 Days (Crew
Member)**. It joins `vw_Asset_Management` to `vw_Assets_All` using the report's
serial-number relationship and applies these report filters:

- Part Status Active is true.
- Catalog Part is false.
- Asset Class is Staff.
- Due For Physical is in the past or no more than 30 days ahead.

The Google Sheet output remains two columns: `Staff Member` and
`Due For Physical`. Overdue members remain in the output.

## Deploy and verify the Worker

1. Commit this repository to GitHub and confirm the `wtfd-operative-preview`
   Cloudflare Worker deploys successfully.
2. Open the deployed Worker route with the existing `SYNC_ADMIN_TOKEN`:

   ```text
   https://wtfd-operative-preview.hartleywtfd.workers.dev/preview-physical-due
   ```

3. Confirm `success` is true, `recordCount` is reasonable, and the returned
   `rows` agree with the old OperativeIQ report. For the supplied August 4,
   2026 export, the comparison baseline is 45 staff rows.

The optional `at` parameter can test the report as of a specific instant without
changing any data:

```text
/preview-physical-due?at=2026-08-04T13:00:00Z
```

## Replace the Apps Script importer

1. Open the Apps Script project bound to the **Due For Physical Next 30 Days**
   workbook.
2. Add or replace the code with `apps-script/DueForPhysicalApi.gs`.
3. Confirm Script Properties contains the existing `SYNC_ADMIN_TOKEN` used by
   the Worker.
4. If the script is not bound to that workbook, add
   `PHYSICAL_DUE_SPREADSHEET_ID` with the workbook's spreadsheet ID.
5. Confirm the worksheet is named `Members Due For Annual Physical`.
6. Run `importDueForPhysicalFromApi` once and approve the requested Google
   authorization.
7. Compare the sheet to the old emailed report.
8. Run `createDailyTriggerForDueForPhysicalApi` once. It removes old triggers
   for both `importDueForPhysicalFromEmail` and `importDueForPhysicalFromApi`,
   then installs one daily API import during the 6:00 AM hour.
9. After the API import has been verified, disable the emailed OperativeIQ
   report. Gmail access is no longer required for this workbook.

No Google service account is required. The Apps Script calls the protected
Worker endpoint using the existing `SYNC_ADMIN_TOKEN`.
