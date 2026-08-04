# OperativeIQ Open Service Tickets API

This workflow replaces the emailed `Open Service Tickets.xls` import with:

`OperativeIQ API -> protected Cloudflare Worker -> Apps Script -> Google Sheet`

The Worker reads Service Desk tickets, keeps records whose resolved status name
is `Open`, and writes the same six report columns:

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

`wrangler-operative-preview.jsonc` sets the verified Service Desk path, Open
status name, destination spreadsheet, and tab name directly. Direct Worker
writes remain disabled because Apps Script performs the Google Sheet update. It
also sets `keep_vars: true` so GitHub/Wrangler deployments preserve other
variables configured in the Cloudflare dashboard.

```bash
npx wrangler deploy --config wrangler-operative-preview.jsonc
```

## 2. Verified Service Desk resource

```bash
curl -H "Authorization: Bearer YOUR_SYNC_ADMIN_TOKEN" \
  "https://wtfd-operative-preview.YOUR_SUBDOMAIN.workers.dev/probe-open-service-tickets"
```

```text
OPERATIVE_SERVICE_TICKETS_PATH=/api/service-desk-tickets
OPEN_SERVICE_TICKET_STATUS_NAME=Open
```

The probe accepts schema-only Swagger. It generates resource candidates from
ticket model names even when the document does not publish API paths. If no
Swagger document is available, the Worker continues with its bounded list of
known Service Desk resource paths and reports the failure as diagnostic
information.

## 3. Compare the read-only preview

```bash
curl -H "Authorization: Bearer YOUR_SYNC_ADMIN_TOKEN" \
  "https://wtfd-operative-preview.YOUR_SUBDOMAIN.workers.dev/open-service-tickets"
```

`/preview-open-service-tickets` is an alias of the same read-only route. Confirm
that `recordCount` and all six displayed fields match the emailed report.

## 4. Configure Apps Script

The Apps Script runs as the Google account that owns the destination sheet, so
no Google service account is required. Add `SYNC_ADMIN_TOKEN` to the Apps
Script project's Script Properties, then paste
`apps-script/OpenServiceTicketsApi.gs` into that project.

```text
OPEN_SERVICE_TICKETS_SHEETS_EXPORT_ENABLED=false
```

Run `importOpenServiceTicketsFromApi` once manually. After confirming the sheet,
run `createThirtyMinuteTriggerForOpenServiceTicketsApi` once to remove the old
email trigger and install the API trigger.

## 5. Keep direct Worker writes disabled

`OPEN_SERVICE_TICKETS_SHEETS_EXPORT_ENABLED` remains `false`. The Worker cron
does not write Google Sheets; the Apps Script trigger clears and replaces
columns A:F every 30 minutes while preserving formatting.

## Routes

- `/probe-open-service-tickets` - GET-only resource discovery
- `/probe-service-ticket-linkage?ticketId=331` - GET-only ticket status,
  detail, `/assigned-items`, and linked-item discovery for a known ticket
- `/open-service-tickets` - normalized read-only open-ticket data
- `/preview-open-service-tickets` - alias of the read-only route
- `/export-open-service-tickets` - optional direct export, intentionally disabled

The preview resolves the numeric ticket status through
`/api/service-desk-ticket-statuses`, keeps only status name `Open`, resolves the
unit through `/api/units` or `/api/unit-locations`, and expands each ticket into
one row per `/api/service-desk-tickets/{id}/assigned-items` record.
