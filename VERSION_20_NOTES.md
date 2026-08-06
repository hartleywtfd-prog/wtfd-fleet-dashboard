# Version 20 — Supply API Explorer

Adds the authenticated read-only endpoint:

`GET /debug/supply?search=<text>`

It returns matching item records and their related item-room, item-room-batch, cycle-count, and supply-room records, including numeric and likely quantity fields and join IDs.
