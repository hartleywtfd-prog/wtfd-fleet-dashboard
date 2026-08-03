# Turnout Gear Crew Email Integration

This update adds a protected, read-only Worker route:

- `/preview-crew-emails`

The route retrieves `/api/crews`, keeps active crew records with valid email
addresses, and returns the first name, last name, crew ID, employee ID, and
email address needed by the turnout-gear notification spreadsheet.

## Deployment

1. Commit the updated repository to GitHub.
2. Confirm the `wtfd-operative-preview` Cloudflare deployment succeeds.
3. Open the Worker URL and verify `/preview-crew-emails` with the existing
   `SYNC_ADMIN_TOKEN`.
4. Replace the bound spreadsheet's Apps Script with the supplied
   `TurnoutGearStandalone.gs` file.
5. Run `refreshCrewEmailReferences` once.
6. Review `Email Reference list` and `No Match` before installing or running
   email notifications.

## Matching and overwrite rules

- Both `First Last` and `Last First` name order are matched.
- A unique token-order match handles suffix placement such as
  `Blakey II Naymon` versus `Naymon Blakey II`.
- Only blank email cells are populated from OperativeIQ.
- Existing nonblank email addresses are preserved as manual overrides.
- Populated rows record `OperativeIQ` as the source and retain the crew ID.
- Ambiguous and unmatched names remain blank for manual review.

No emails are sent by setup, import, or reference-refresh functions.
