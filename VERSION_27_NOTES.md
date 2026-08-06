# Version 27

## Garment-specific size correction

- Coats use OperativeIQ **Coat Size**.
- Pants use OperativeIQ **Pant Size**.
- A blank Pant Size on a coat is ignored.
- A blank Coat Size on pants is ignored.
- Other PPE continues to use the general size field.
- The preview payload now returns `coatSize`, `pantSize`, and the correct normalized `size`.
- Warehouse size availability, member profiles, and asset details use the corrected normalized size.
