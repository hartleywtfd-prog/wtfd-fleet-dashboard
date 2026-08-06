# Version 21 — Optimized Supply Inventory

The supply inventory route now avoids Cloudflare's per-invocation subrequest limit.

It performs four single-page requests:

1. `/api/supply-rooms`
2. `/api/categories`
3. `/api/item-room-batches` filtered to the Turnout Gear Supply Warehouse room ID
4. `/api/items` filtered to the Turnout Gear category ID

Current inventory is calculated by summing `currentQty` for each `itemId` in the warehouse. `receivedQty` is retained only as historical source data and is not used for the live balance.
