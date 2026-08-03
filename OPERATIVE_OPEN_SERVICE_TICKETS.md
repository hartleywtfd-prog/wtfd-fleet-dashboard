# OperativeIQ Open Service Tickets API

This workflow replaces the emailed `Open Service Tickets.xls` import with:

`OperativeIQ API -> protected Cloudflare Worker -> Google Sheets API`

The Worker reads Service Desk tickets, excludes closed/resolved/completed or
cancelled records, and writes the same six report columns:

1. Created
2. Asset Description
3. Ticket Name
4. Unit Name
5. Description
6. Status

## Safety defaults

The OperativeIQ routes remain protected by `SYNC_ADMIN_TOKEN`. Google Sheets
writes are disabled unless this variable is explicitly set:

```text
OPEN_SERVICE_TICKETS_SHEETS_EXPORT_ENABLED=false
```

Do not disable the emailed report until the API preview and exported sheet have
matched the emailed report.

## 1. Deploy the Worker

```bash
npx wrangler deploy --config wrangler-operative-preview.jsonc
```

## 2. Discover the Service Desk resource

```bash
curl -H "Authorization: Bearer YOUR_SYNC_ADMIN_TOKEN" \
  "https://wtfd-operative-preview.YOUR_SUBDOMAIN.workers.dev/probe-open-service-tickets"
```

Use the `recommendedResource.path` value as the Worker variable:

```text
OPERATIVE_SERVICE_TICKETS_PATH=/api/VERIFIED_RESOURCE
```

## 3. Compare the read-only preview

```bash
curl -H "Authorization: Bearer YOUR_SYNC_ADMIN_TOKEN" \
  "https://wtfd-operative-preview.YOUR_SUBDOMAIN.workers.dev/open-service-tickets"
```

`/preview-open-service-tickets` is an alias of the same read-only route. Confirm
that `recordCount` and all six displayed fields match the emailed report.

## 4. Configure the destination sheet

Share the destination spreadsheet with the existing
`GOOGLE_SERVICE_ACCOUNT_EMAIL` as Editor. Set these Worker variables:

```text
OPEN_SERVICE_TICKETS_SPREADSHEET_ID=1tiOyFEbDc-a0oQ2cVNPjK-7kE9QFYZrpm72vew2Ee4o
OPEN_SERVICE_TICKETS_TAB_NAME=Open Service Tickets
OPEN_SERVICE_TICKETS_SHEETS_EXPORT_ENABLED=false
```

The existing `GOOGLE_SERVICE_ACCOUNT_EMAIL` and
`GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` secrets are reused. The ticket spreadsheet
ID is separate from the incomplete-check spreadsheet ID.

## 5. Enable and test the export

After the preview matches, set:

```text
OPEN_SERVICE_TICKETS_SHEETS_EXPORT_ENABLED=true
```

Run one protected manual export:

```bash
curl -H "Authorization: Bearer YOUR_SYNC_ADMIN_TOKEN" \
  "https://wtfd-operative-preview.YOUR_SUBDOMAIN.workers.dev/export-open-service-tickets"
```

The existing 30-minute cron will then clear and replace columns A:F on the
`Open Service Tickets` tab. Formatting outside cell contents is preserved.

## Routes

- `/probe-open-service-tickets` - GET-only resource discovery
- `/open-service-tickets` - normalized read-only open-ticket data
- `/preview-open-service-tickets` - alias of the read-only route
- `/export-open-service-tickets` - separately guarded Google Sheets export

