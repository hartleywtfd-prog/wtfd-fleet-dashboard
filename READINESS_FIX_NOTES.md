# Operational Readiness layout fix

Updated July 31, 2026.

## Included changes

- Prevented the right-side dashboard cards from stretching to match the height of Current Crew Needs.
- Combined the Immediate Actions `Item` and `Action` columns into a wrapped `Issue / Action` column.
- Limited Immediate Actions to vertical scrolling and removed its horizontal scrollbar.
- Preserved the Cloudflare readiness API integration and the correct `7-Day Hours` data field.

## Deployment

Deploy this complete project to the existing Cloudflare Pages project. No Cloudflare environment-variable changes are required.

The separate Google Apps Script HTML should also use `row['7-Day Hours']` when rendering the Current Crew Needs hours column.
