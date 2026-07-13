# WTFD Fleet Dashboard v2.4.0

This release includes standard-dashboard and unattended-kiosk refinements.

## Standard dashboard
- Clear Last Update label with green/yellow/red age states
- More legible command-status cards
- Larger, better-spaced status legend
- Subtle responding-unit halo; moving units remain static
- Active911 elapsed-time counter
- “GPS Issues” terminology

## Kiosk dashboard
- Search, Force Sync, layer controls, and zoom controls remain hidden
- Sidebar reduced for additional map space
- Vehicle markers reduced approximately 10–15% while retaining label readability
- No Normal Operations banner when no incident or response exists
- Larger update-age treatment and legend
- Explicit station occupancy counts
- Active911 elapsed-time counter

## Deployment
Replace the repository contents with these files, commit, and allow Cloudflare Pages to redeploy. Then hard refresh the browser with Ctrl+F5.

## v2.3.0 GPS age formatting
- Stale GPS badges now use human-readable ages such as `GPS 4h 49m old`.
- Ages under one hour show minutes, and ages over one day show days and hours.


## v2.4.0 Samsara away-location formatting
- Away units now show the municipality or township parsed from Samsara's Current Location value.
- Postal codes are no longer used when a municipality is available.
- Display fallback order is municipality/township, street or available location text, then `Away`.
- `Washington Township` is shortened to `Washington Twp` to fit the sidebar.
- The improved location label is used on both the standard dashboard and kiosk Units Away list.
