# Version 32 — Turnout Custom Size Worker Fix

- Synchronizes the deployed Worker entry file (`workers/operative-preview.js`) with the Version 31 custom-field implementation.
- Loads `Coat Size` and `Pant Size` definitions from `/api/extended-properties`.
- Loads their values from `/api/extended-property-values` and joins them to the turnout item catalog.
- Populates `coatSize`, `pantSize`, `size`, and `sizeSource` in `/preview-turnout-gear`.
- Treats both `Pant` and `Pants` as pant garments.
- Adds custom-field diagnostics to the preview response.

The prior package contained the corrected logic in the root `operative-preview.js`, while Wrangler deploys `workers/operative-preview.js`. This release places the corrected implementation in the actual configured Worker entry file.
