# Version 34 — Turnout Gear Source Stability

- Adds stable server-side ordering to the OperativeIQ turnout gear dynamic-view reads before pagination.
- Prevents duplicate asset-tag rows from being resolved by API return order.
- Chooses duplicate rows deterministically using the newest service/record timestamp, then physical-location priority, then a stable tie-breaker.
- Keeps Phoenix Gear Repair classification and exclusion from active inspection due/overdue workload.
- Preserves Coat Size / Pant Size custom-field enrichment with Notes fallback.

This change is intended to stop turnout counts (overdue, issued due, warehouse stock) from changing between refreshes when the underlying OperativeIQ data has not changed.
