# Turnout Gear Warehouse Identification Fix

This update changes `/preview-turnout-gear` so the dashboard can identify assets physically located at **Turnout Gear Supply Warehouse**.

## Changes

- The physical `Location` / `To` value is authoritative for location classification.
- `Turnout Gear Supply Warehouse` is returned as `locationType: "Warehouse"` even when a Crew Member remains associated with the asset history row.
- Warehouse items are no longer excluded from the preview.
- All active Turnout Gear subcategories are included, not only coats and pants. This includes boots, helmets, hoods, gloves, and other turnout PPE.
- Records are no longer limited to service due within 30 days. The dashboard applies its own maintenance filters.
- The preview includes `serialNumber`, `physicalLocation`, and `crewMember` fields when available.

No OperativeIQ records are changed. The endpoint remains read-only.
