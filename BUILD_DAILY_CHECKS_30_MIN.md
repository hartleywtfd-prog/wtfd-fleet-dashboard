# Daily vehicle checks — 30-minute central refresh

- Changes the incomplete-check cron from hourly to every 30 minutes.
- Keeps the 07:00–06:59 America/New_York active-shift boundary.
- Compares the newly prepared result with the current D1 snapshot.
- Writes only added, changed, or removed rows.
- Skips D1 and Google Sheets writes when the result is unchanged.
- Adds change counts to the scheduled structured log.
