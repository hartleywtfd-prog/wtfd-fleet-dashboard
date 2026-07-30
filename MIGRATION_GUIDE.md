# WTFD Fleet Dashboard — Cloudflare/D1 Stage 1

This package runs beside the live Apps Script dashboard. It does not replace
`/api/dashboard`, does not disable either Apps Script trigger, and does not
migrate the temporary OperativeIQ CSV workflow.

## What is included

- `d1/schema.sql` — D1 tables
- `d1/seed.sql` — 26 vehicles, 20 facilities, and public settings
- `workers/samsara-sync.js` — scheduled Samsara snapshot-to-D1 synchronization
- `functions/api/dashboard-v2.js` — D1 response in the existing dashboard format
- `functions/api/dashboard-compare.js` — old-versus-new comparison
- `wrangler-samsara.jsonc` — separate scheduled Worker configuration

## Safety model

The live `/api/dashboard` and `/api/sync` files are unchanged. The new API is
available only at `/api/dashboard-v2`. Switching the visible dashboard is a
later step after comparison.

## Cloudflare setup

### 1. Create D1

Create a D1 database named `wtfd-fleet`. Copy its database ID.

### 2. Create the schema and seed records

From the extracted project folder, run:

```bash
npx wrangler d1 execute wtfd-fleet --remote --file=d1/schema.sql
npx wrangler d1 execute wtfd-fleet --remote --file=d1/seed.sql
```

### 3. Bind D1 to the Pages project

In the existing Cloudflare Pages project, add a D1 binding:

- Variable name: `DB`
- D1 database: `wtfd-fleet`

Add it to both Preview and Production if comparison will be performed in both.
Redeploy the Pages project after adding the binding.

### 4. Configure the scheduled Worker

The supplied `wrangler-samsara.jsonc` already contains the `wtfd-fleet`
database ID created for this migration.

Deploy the Worker:

```bash
npx wrangler deploy --config wrangler-samsara.jsonc
```

Add secrets without placing their values in a file:

```bash
npx wrangler secret put SAMSARA_TOKEN --config wrangler-samsara.jsonc
npx wrangler secret put SYNC_ADMIN_TOKEN --config wrangler-samsara.jsonc
```

`SYNC_ADMIN_TOKEN` is a new random value used only for protected manual tests.
The scheduled synchronization does not require it.

Deploy once more after the secrets are set.

### 5. Verify without switching the dashboard

Wait two minutes, then open:

- `/api/dashboard-v2`
- `/api/dashboard-compare`

The comparison route allows up to 100 feet of GPS movement before marking a
location difference. Assignment differences may temporarily appear because the
legacy feed still receives OperativeIQ CSV assignments while Stage 1 uses the
provided UnitConfig primary assignments.

## Cutover requirements

Do not change the main dashboard endpoint and do not disable `syncLocations`
until:

1. D1 returns all expected active vehicles.
2. Emergency-light values match.
3. Station and facility resolution matches.
4. GPS freshness is consistent.
5. At least one moving vehicle has been observed.
6. At least one responding vehicle has been observed, when operationally
   practical.
7. The future OperativeIQ API assignment feed is connected or an explicit
   temporary assignment strategy is selected.

## Rollback

Stage 1 requires no rollback because the live endpoint is unchanged. If the new
Worker misbehaves, disable its cron trigger; Apps Script continues operating.
