# Version 33 — Turnout Gear Physical Location Fix

- Makes OperativeIQ Physical Location / To authoritative for turnout gear location classification.
- Classifies `Phoenix Gear Repair` as `Out for Repair / Inspection`.
- Prevents a historical `Crew Member` value from making warehouse or repair-vendor gear appear issued to that member.
- Keeps the original `crewMember` field in each row for audit/reference, while `issuedTo` now follows the physical location unless the location itself is `Crew: <member>`.
- Adds `diagnostics.repairInspection` so the number of garments at repair/inspection locations can be verified directly.
- Preserves the Version 32 optional Coat Size / Pant Size enrichment and Notes fallback.

Expected result for the 2026-08-26 Phoenix Gear Repair sample: 26 garments classify as `Out for Repair / Inspection` instead of being mixed into issued/warehouse work queues.
