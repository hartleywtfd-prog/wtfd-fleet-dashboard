# Version 28 — Turnout Asset Field Explorer

Adds the authenticated, read-only route:

`/debug/turnout-asset?search=Coat-26`

The route returns matching raw records from `vw_Asset_Management` and `vw_Assets_All`, highlights all size-related fields, and links management records by asset tag when possible.
