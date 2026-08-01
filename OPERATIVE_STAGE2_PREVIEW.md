# OperativeIQ Stage 2 - Cloudflare assignment sync

This stage authenticates directly to the OperativeIQ production API, compares
API assignments with D1, and can update D1 every five minutes after the write
guard is explicitly enabled. It does not change `/api/dashboard-v2` and does
not affect the live Apps Script dashboard or its emailed CSV import.

## 1. Create the preview tables

From the project folder, run:

```bash
npx wrangler d1 execute wtfd-fleet --remote --file=d1/stage2-operative-preview.sql
```

These tables reserve the Stage 2 audit structure. Preview requests do not
write assignment values to them.

## 2. Deploy the protected preview Worker

```bash
npx wrangler deploy --config wrangler-operative-preview.jsonc
```

Add the credentials as Cloudflare Worker secrets. Do not place their values in
source files or `wrangler-operative-preview.jsonc`.

```bash
npx wrangler secret put OPERATIVE_CLIENT_ID --config wrangler-operative-preview.jsonc
npx wrangler secret put OPERATIVE_CLIENT_SECRET --config wrangler-operative-preview.jsonc
npx wrangler secret put SYNC_ADMIN_TOKEN --config wrangler-operative-preview.jsonc
```

`SYNC_ADMIN_TOKEN` should be a new random value used only to protect manual
inspection and preview requests.

Deploy again after the secrets are set:

```bash
npx wrangler deploy --config wrangler-operative-preview.jsonc
```

## 3. Discover the assignment endpoint

Use the Worker URL returned by Wrangler:

```bash
curl -H "Authorization: Bearer YOUR_SYNC_ADMIN_TOKEN" \
  "https://wtfd-operative-preview.YOUR_SUBDOMAIN.workers.dev/inspect"
```

The response lists Swagger paths containing likely unit, call-sign,
assignment, apparatus, vehicle, or service-status resources. It never returns
the OperativeIQ access token or client secret.

## 4. Preview a candidate endpoint

Replace the example path with the relevant path returned by `/inspect`:

```bash
curl -G \
  -H "Authorization: Bearer YOUR_SYNC_ADMIN_TOKEN" \
  --data-urlencode "path=/api/REPLACE_WITH_ASSIGNMENT_RESOURCE" \
  "https://wtfd-operative-preview.YOUR_SUBDOMAIN.workers.dev/preview"
```

The preview returns detected source fields, normalized record counts, proposed
assignment differences, and warnings. It does not update D1.

## Existing assignment rules preserved in preview

- Match physical vehicles by F-number from OperativeIQ Unit Number.
- Select the newest Created Date record, then the newest Shift ID on a tie.
- Normalize `Medic 1-44` to `Medic 144`.
- Normalize `Medic 2-44` to `Medic 244`.
- Treat In-Service and Reserve as eligible.
- Treat Unavailable, Out of Service, and Maintenance as inactive.
- Ignore F140.
- Warn about apparatus absent from the D1 vehicle configuration.

The duplicate-call-sign release rules, F131/Safety 40 fallback, and actual D1
writes will be added only after the real API endpoint and field names pass this
preview.

## 5. Enable the five-minute assignment sync

The scheduled event is deployed in a disabled state unless this Worker
variable is set to `true`:

```text
OPERATIVE_APPLY_ENABLED=true
```

When the variable is false or absent, each scheduled event exits without
calling OperativeIQ or writing D1. Keep it false until
`/preview-live-assignments` returns the expected assignments. The protected
`/sync-live-assignments` route uses the same guard.

The schedule is configured in `wrangler-operative-preview.jsonc` as:

```text
*/5 * * * *
```

## Production dashboard remains unchanged

Continue running all of the following:

- Cloudflare `wtfd-samsara-sync` cron
- Apps Script `syncLocations` trigger
- Apps Script OperativeIQ email trigger
- Live dashboard `/api/dashboard`

Do not cut over the visible dashboard until the D1 comparison and operational
checks are complete.
