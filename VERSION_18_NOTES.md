# Version 18 — Supply Filter Correction

The read-only supply inventory route now uses the department-confirmed OperativeIQ classification:

- Asset Type = `Supply Part`
- Category = `Turnout Gear`
- Active record
- Warehouse location associated with Turnout Gear Supply Warehouse

Name-based matching is no longer used to include records. The exclusion pattern remains only as a final cleanup rule.
