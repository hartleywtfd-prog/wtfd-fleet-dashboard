WTFD PHYSICAL-DUE 4-HOUR PATCH

This is an overlay/patch package for the current wtfd-fleet-dashboard repository.

Because the connected GitHub integration has read-only access to
hartleywtfd-prog/wtfd-fleet-dashboard, this package cannot be committed there automatically.

Preferred use:
1. Download/extract the current wtfd-fleet-dashboard repository.
2. Copy this patch folder into the repository root.
3. From the repository root run:
      python apply_physical_due_4h_patch.py
4. Commit the resulting repository to GitHub.
5. Confirm the wtfd-operative-preview Worker deploys.
6. In the Due For Physical Apps Script project, run:
      createFourHourTriggerForDueForPhysicalApi
7. Verify the old daily trigger is gone and the new trigger is present.
8. Test the Worker twice with the existing Authorization token.
   First normal request should show:
      X-WTFD-Physical-Due-Cache: MISS
   Second normal request should show:
      X-WTFD-Physical-Due-Cache: HIT

No Pi restart is required for this change.
