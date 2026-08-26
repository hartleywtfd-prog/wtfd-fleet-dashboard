# Open service tickets — two-hour refresh

- Changes the optional Worker export cron from hourly to every two hours.
- Changes the Google Apps Script trigger installer from 30 minutes to two hours.
- Keeps a backward-compatible setup function so the old installer name also
  replaces existing triggers with the new two-hour cadence.
