# Version 35 — Stable Turnout Gear Snapshot

## Purpose
Prevents turnout-gear counts from changing on every browser refresh when OperativeIQ paginated dynamic views return inconsistent pages.

## Changes
- `/preview-turnout-gear` now serves the last known-good snapshot from the existing `wtfd-fleet` D1 database.
- The existing 30-minute cron builds a fresh candidate snapshot.
- A changed candidate must be observed on two consecutive scheduled refreshes before it is promoted.
- A failed or incomplete source pull never replaces the last known-good snapshot.
- `fetchAll()` now rejects incomplete pagination when `X-Overall-Count` proves rows are missing.
- Added `/turnout-gear-snapshot-status` for read-only snapshot diagnostics.
- Added `/refresh-turnout-gear-snapshot`; `?force=1` performs an explicit operator-forced promotion.
- No OperativeIQ writes were added. D1 stores only prepared dashboard JSON.

## Deployment
No new Cloudflare binding is required. The Worker already binds D1 as `DB` to `wtfd-fleet`. The table is created automatically on first use; `d1/turnout-gear-snapshot-v35.sql` is included as documentation/reference.
