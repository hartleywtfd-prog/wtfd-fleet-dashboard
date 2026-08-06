# Version 22 — Supply Inventory Query Corrections

## Operative preview Worker
- Enforces OperativeIQ's maximum `$top=200`.
- Maps `itemName`, `partType`, `categoryId`, `uomlabelId`, `totalQuantity`, `reorderPoint`, and `maxQuantity`.
- Treats `Active` status as active instead of boolean false.
- Uses `currentQty` from `/api/item-room-batches` and joins directly by `itemId`.
- Numeric supply debug searches use `id eq <number>`.
- Text supply debug searches use `itemName`.
- Debug batch joins no longer require `/api/item-rooms`.

## Dashboard
- Version label updated to 22.
- No Cloudflare variables or secrets change.
