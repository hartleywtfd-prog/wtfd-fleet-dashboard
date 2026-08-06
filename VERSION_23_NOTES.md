# Version 23 — Supply Part Paging Fix

- Resolves the Supply Part `itemTypeId` from known item 3311.
- Queries OperativeIQ by both Turnout Gear category ID and Supply Part item type ID.
- Falls back to paging all Turnout Gear items in 200-record pages when combined OData filtering is unsupported.
- Includes item IDs in debug-search matching.
- Continues to sum `currentQty` for batches in Turnout Gear Supply Warehouse.
