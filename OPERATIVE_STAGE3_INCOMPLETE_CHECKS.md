# OperativeIQ Stage 3 - Daily Incomplete Checks

This stage replaces the emailed CSV import with:

`OperativeIQ API -> Cloudflare Worker -> D1 -> Google Sheets API`

The active shift runs from 07:00 through 06:59:59 in America/New_York. Checks
do not carry into the next shift. Only operational apparatus/equipment
questionnaires are eligible. Completed and out-of-service checks are excluded.
The scheduled sync runs every 30 minutes. It compares the prepared current-shift
result with D1 and writes only added, changed, or removed rows. An unchanged run
does not rewrite D1 or Google Sheets.

## Safety defaults

Both new write paths are disabled unless explicitly enabled:

```text
INCOMPLETE_CHECKS_D1_ENABLED=false
GOOGLE_SHEETS_EXPORT_ENABLED=false
```

The existing OperativeIQ assignment synchronization remains controlled by its
separate `OPERATIVE_APPLY_ENABLED` setting.

Do not disable the Gmail/CSV Apps Script until API and CSV outputs have been
run in parallel and accepted.

## Operational questionnaire filter

The default case-insensitive pattern is:

```text
(?:UTV.*Check\s*List|Daily\s+Engine|Admin\s+Battalion\s+Daily)
```

Override it with `OPERATIVE_OPERATIONAL_CHECK_PATTERN` if another operational
questionnaire must be included. Preview the result before enabling writes.

## 1. Create D1 tables

```bash
npx wrangler d1 execute wtfd-fleet --remote --file=d1/stage3-incomplete-checks.sql
```

## 2. Deploy with writes disabled

Keep these Worker variables false:

```text
INCOMPLETE_CHECKS_D1_ENABLED=false
GOOGLE_SHEETS_EXPORT_ENABLED=false
```

Deploy:

```bash
npx wrangler deploy --config wrangler-operative-preview.jsonc
```

## 3. Validate the current-shift preview

```bash
curl -H "Authorization: Bearer YOUR_SYNC_ADMIN_TOKEN" \
  "https://wtfd-operative-preview.YOUR_SUBDOMAIN.workers.dev/preview-current-incomplete-checks"
```

The response must contain only operational checks assigned to the active
07:00 shift and still incomplete. It performs no writes.

An optional ISO timestamp can test the shift boundary:

```text
/preview-current-incomplete-checks?at=2026-08-03T10:59:00Z
/preview-current-incomplete-checks?at=2026-08-03T11:00:00Z
```

Those timestamps represent 06:59 and 07:00 EDT.

## 4. Configure Google Sheets

Create a Google Cloud service account with the Google Sheets API enabled. Share
the target spreadsheet with the service-account email as Editor.

Set these Worker secrets:

```bash
npx wrangler secret put GOOGLE_SERVICE_ACCOUNT_EMAIL --config wrangler-operative-preview.jsonc
npx wrangler secret put GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY --config wrangler-operative-preview.jsonc
npx wrangler secret put GOOGLE_SHEETS_SPREADSHEET_ID --config wrangler-operative-preview.jsonc
```

Optional Worker variable:

```text
GOOGLE_SHEETS_TAB_NAME=Incomplete Daily Checks
```

The export clears and replaces columns A:F with:

1. Date
2. Location Name
3. Unit Number
4. In-Service Status
5. Questionnaire Name
6. Status

## 5. Enable D1 writes first

Set:

```text
INCOMPLETE_CHECKS_D1_ENABLED=true
GOOGLE_SHEETS_EXPORT_ENABLED=false
```

Run the protected `/sync-incomplete-checks` route and inspect D1. Google Sheets
remains untouched.

## 6. Enable Google Sheets after D1 validation

Set:

```text
GOOGLE_SHEETS_EXPORT_ENABLED=true
```

Run `/export-incomplete-checks`, then verify the worksheet. The 30-minute cron
will subsequently refresh D1 and the sheet. At 07:00, the prior shift rows are
replaced by the new shift result.

## Routes

- `/preview-current-incomplete-checks` - read-only final-filter preview
- `/sync-incomplete-checks` - guarded OperativeIQ-to-D1 synchronization
- `/export-incomplete-checks` - guarded D1-to-Google-Sheets export
