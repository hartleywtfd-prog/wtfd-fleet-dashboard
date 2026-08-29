# Version 36 – Phoenix repair exclusion hardening

- Treats any physical location containing `Phoenix Gear Repair` as out for repair / inspection.
- Normalizes those records to the canonical location `Phoenix Gear Repair Supply Room` before snapshot storage.
- This ensures downstream dashboard logic always recognizes Phoenix records and excludes them from overdue, due-today, due-window, inspection-queue, and workload calculations.
- Preserves the v35 stable D1 snapshot behavior and existing size/location fixes.
