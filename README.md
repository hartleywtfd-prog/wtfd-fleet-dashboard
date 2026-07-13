# WTFD Fleet Dashboard - Cloudflare Pages

Version 2.1.0

## Project contents

Upload the complete contents of this folder to the GitHub repository connected to Cloudflare Pages:

- `index.html`
- `styles.css`
- `script.js`
- `logo.png`
- `functions/api/active911.js`
- `functions/api/dashboard.js`
- `functions/api/sync.js`

Do not omit the `functions` directory. Cloudflare Pages Functions use those files to proxy dashboard, sync, and Active911 requests.

## Cloudflare Pages settings

- Framework preset: None
- Build command: leave blank
- Build output directory: `/`

## Dashboard URLs

Interactive dashboard:

```text
https://your-dashboard-domain/
```

Kiosk / command display:

```text
https://your-dashboard-domain/?mode=kiosk
```

## Deployment

1. Replace the existing repository files with the complete contents of this folder.
2. Commit and push the changes to GitHub.
3. Wait for Cloudflare Pages to finish deploying.
4. Refresh the browser with `Ctrl + F5`.

The Apps Script endpoints are configured through the Cloudflare Pages Function files. There is no `APPS_SCRIPT_API_URL` setting in `script.js`.


## Version 2.0 enhancements

- Rolling Active911 recent-incident banner: maximum five incidents, ten-minute expiration
- Existing Active911 popup remains at 15 seconds
- Local fleet-data cache during temporary outages
- Automatic five-second reconnect attempts and reconnect overlay
- Relative fleet-data age display
- Automatic street/dark map switching at 7:00 AM and 7:00 PM
- More visible service-area shading
- Six-hour kiosk refresh and kiosk home-view recovery
- Corrected duplicate JavaScript declaration in the Active911 section

The incident banner only represents recent alerts because Active911 does not provide unit status or clear updates.


## Version 2.1.0 refinements
- Reduced kiosk sidebar width to provide more map area.
- Reduced recent-incident banner height from 96px to 72px.
- Banner still collapses completely when no recent incidents exist.
- Added subtle pulse to recent-incident icons.
- Added units-present count to each station card.
- Stale status badges now show GPS age in minutes.
- Kiosk away list now favors the municipality/area instead of a long street string.
- Enlarged the kiosk legend slightly for distance viewing.
- Maintained the 15-second top Active911 alert and 10-minute recent-incident retention.

A response-path line was not added because the Active911 feed does not identify assigned/responding apparatus. Drawing one from emergency-light status alone could falsely associate a unit with the incident.
