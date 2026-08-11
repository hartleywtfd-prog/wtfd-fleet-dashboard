# Gear Inspection Email Fix V2

The diagnostic showed every row returning `Unassigned`. V2 joins `vw_Asset_Management` to `vw_Assets_All` by asset tag, restoring the crew-member assignment while keeping the email endpoint to two bulk OperativeIQ reads. It returns only active Coat/Pants records due in 0-30 days and only records assigned to a crew member.

No Apps Script change is required if it already uses `/preview-turnout-gear-inspections`. Deploy this Worker build, then run `diagnoseGearInspectionMatching()` before any live send.
