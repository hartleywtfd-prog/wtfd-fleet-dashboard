# WTFD Fleet Dashboard — Cloudflare Workers deploy repair

This repair preserves the `wtfd-fleet-dashboard` Worker and the existing website/API endpoints.

## Changed

- Added `wrangler.jsonc` targeting the existing Worker.
- Added `src/worker.js` to route `/api/*` to the original seven Pages Functions.
- Copied static website files into `public/` (originals remain untouched for traceability).
- Configured the D1 `DB` binding to the existing `wtfd-fleet` database ID from `wrangler-samsara.jsonc`.
- Preserved the existing Car 45 frontend fixes.

## Deploy

1. Extract the ZIP and upload the contents to the root of `hartleywtfd-prog/wtfd-fleet-dashboard`, including the **new `public/`, `src/`, and `wrangler.jsonc`**. Existing files can remain.
2. In the existing Cloudflare Worker > Settings > Builds, leave the deploy command as `npx wrangler deploy` and the root as `/`. Leave the production branch `main`.
3. Make sure the Worker has the necessary secrets (never put token values in GitHub): `ACTIVE911_REFRESH_TOKEN`, `CREWSENSE_CLIENT_ID`, `CREWSENSE_CLIENT_SECRET`, `READINESS_WEB_APP_URL`, `READINESS_API_TOKEN` (the last two only if readiness is used). Existing static-only Workers cannot store secrets until code is deployed.
4. Check build log for success; validate `/`, `/?mode=kiosk`, `/api/dashboard-v2`, `/api/crewsense`, and `/api/active911`. If credentials are missing, API route will give an error until configured.
5. If needed, configure `READINESS_WEB_APP_URL` and `READINESS_API_TOKEN`; check D1 database ID is correct for this Cloudflare account.

## Important

This package was syntax-checked with Node. Cloudflare runtime bindings and the end-to-end deployment have not been tested against the live Cloudflare account. The `workers/` directory and alternate `wrangler-*.jsonc` files are kept for the separately deployed scheduled Workers, not for the website deployment.

A successful static asset deployment does not by itself establish that the API integrations work. Test them before considering the repair complete.
