# Version 31 — OperativeIQ Custom Size Mapping

- Loads the custom-field definitions for **Coat Size** and **Pant Size**.
- Retrieves their values in bulk through `/api/extended-property-values`.
- Maps the values to the underlying OperativeIQ item ID.
- Coats use only Coat Size; pants use only Pant Size.
- Item Notes remains a fallback for older records only.
- Adds diagnostics for resolved property IDs and mapped custom-size items.
- Updates the dashboard label to Version 31.
