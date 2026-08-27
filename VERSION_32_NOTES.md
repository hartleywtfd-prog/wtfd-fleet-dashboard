# Version 32 — Turnout Custom Size Worker Fix

- Synchronizes the deployed Worker entry file (`workers/operative-preview.js`) with the Version 31 custom-field implementation.
- Loads `Coat Size` and `Pant Size` definitions from `/api/extended-properties`.
- Loads their values from `/api/extended-property-values` and joins them to the turnout item catalog.
- Populates `coatSize`, `pantSize`, `size`, and `sizeSource` in `/preview-turnout-gear`.
- Treats both `Pant` and `Pants` as pant garments.
- Adds custom-field diagnostics to the preview response.

The prior package contained the corrected logic in the root `operative-preview.js`, while Wrangler deploys `workers/operative-preview.js`. This release places the corrected implementation in the actual configured Worker entry file.

## Turnout gear custom-size resilience fix
- Keeps Asset Management, Assets All, and turnout item catalog reads as required core data.
- Treats Coat Size/Pant Size extended-property definitions and values as optional enrichment.
- Falls back to OperativeIQ item Notes for size when custom fields are unavailable.
- Adds size enrichment warnings/diagnostics instead of returning HTTP 500 for optional size API failures.
- Corrects `sizeSource` so it reports custom fields only when a real custom-field value was used.
- Keeps `/debug/turnout-asset` independent of the optional extended-properties API.
