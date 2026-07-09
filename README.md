# WTFD Fleet Dashboard - Cloudflare Pages Version

## Files for GitHub / Cloudflare Pages
Upload these files to your GitHub repository:

- `index.html`
- `styles.css`
- `script.js`
- `logo.png`

## Critical setup step
Open `script.js` and replace this line:

```js
const APPS_SCRIPT_API_URL = 'PASTE_YOUR_APPS_SCRIPT_EXEC_URL_HERE';
```

with your Apps Script Web App `/exec` URL, for example:

```js
const APPS_SCRIPT_API_URL = 'https://script.google.com/macros/s/AKfycb.../exec';
```

## Apps Script backend
Copy the contents of `AppsScript_Cloudflare_API.gs` into your Apps Script project.
It can replace your current `doGet()` in `Code.gs`, or be merged into the same file.

Then:

1. Save Apps Script.
2. Deploy > Manage deployments.
3. Edit your Web App deployment.
4. Select **New version**.
5. Deploy.

## Cloudflare Pages settings
- Framework preset: None
- Build command: leave blank
- Output directory: `/`

## How it works
The Cloudflare page uses JSONP to get data from Apps Script. This avoids browser CORS issues.
Apps Script continues syncing Samsara to your Google Sheet exactly as before.
