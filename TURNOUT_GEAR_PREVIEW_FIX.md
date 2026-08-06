# Turnout Gear Preview CPU Fix

This update repairs `/preview-turnout-gear` failures that surfaced as Cloudflare HTTP 503 with error code 1102.

## Changes

- Normalizes dynamic-view field names once per record instead of repeatedly scanning every field for every lookup.
- Limits each turnout dynamic-view source to a 5,000-record safety ceiling.
- Adds a two-minute warm-isolate cache for dashboard refreshes.
- Preserves the existing 0–30 day maintenance filter.
- Adds `currentLocation`, `locationType`, `partDescription`, `subcategory`, and `plannedDecommissionDate` to each returned row.
- Keeps the route read-only.

## Deployment

Deploy this repository using `wrangler-operative-preview.jsonc`, as before. Existing secrets and bindings remain unchanged.
