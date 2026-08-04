import assert from 'node:assert/strict';
import worker from '../workers/operative-preview.js';

const managementRows = [
  {
    serial___Part_Number: 'EMP-001',
    part_Description: 'Past Due Member',
    part_Status_Active: true,
    catalog_Part: false,
    asset_Class: 'Staff',
    preventative_Maintenace_Date: '2025-01-01T05:00:00Z',
    next_Preventative_Maintenace_Date: '2026-01-01T05:00:00Z'
  },
  {
    serial___Part_Number: 'EMP-002',
    part_Description: 'September Member',
    part_Status_Active: true,
    catalog_Part: false,
    asset_Class: 'Staff',
    preventative_Maintenace_Date: '2025-09-01T04:00:00Z',
    next_Preventative_Maintenace_Date: '2026-09-01T04:00:00Z'
  },
  {
    serial___Part_Number: 'EMP-002',
    part_Description: 'September Member',
    part_Status_Active: true,
    catalog_Part: false,
    asset_Class: 'Staff',
    preventative_Maintenace_Date: '2024-09-01T04:00:00Z',
    next_Preventative_Maintenace_Date: '2026-09-01T04:00:00Z'
  },
  {
    serial___Part_Number: 'EMP-003',
    part_Description: 'Beyond Window Member',
    part_Status_Active: true,
    catalog_Part: false,
    asset_Class: 'Staff',
    next_Preventative_Maintenace_Date: '2026-09-04T04:00:00Z'
  },
  {
    serial___Part_Number: 'EMP-004',
    part_Description: 'Inactive Member',
    part_Status_Active: false,
    catalog_Part: false,
    asset_Class: 'Staff',
    next_Preventative_Maintenace_Date: '2026-08-15T04:00:00Z'
  },
  {
    serial___Part_Number: 'EMP-005',
    part_Description: 'Catalog Member',
    part_Status_Active: true,
    catalog_Part: true,
    asset_Class: 'Staff',
    next_Preventative_Maintenace_Date: '2026-08-15T04:00:00Z'
  },
  {
    serial___Part_Number: 'EMP-006',
    part_Description: 'Wrong Class Member',
    part_Status_Active: true,
    catalog_Part: false,
    asset_Class: 'Turnout Gear',
    next_Preventative_Maintenace_Date: '2026-08-15T04:00:00Z'
  },
  {
    serial___Part_Number: 'EMP-007',
    part_Description: 'Missing Date Member',
    part_Status_Active: true,
    catalog_Part: false,
    asset_Class: 'Staff'
  }
];

const assetRows = managementRows
  .filter((row, index) => index !== 2)
  .map(row => ({
    serial_Number: row.serial___Part_Number,
    asset_Class: row.asset_Class,
    asset_Tag_Number: `TAG-${row.serial___Part_Number}`,
    location: 'Crew'
  }));

globalThis.fetch = async input => {
  const url = new URL(String(input));
  if (url.hostname === 'auth.operativeiqfrontline.com') {
    return Response.json({ access_token: 'operative-test-token', expires_in: 3600 });
  }
  if (url.pathname.endsWith('/api/dynamic-views/vw_Asset_Management')) {
    assert.equal(url.searchParams.get('$filter'), "asset_Class eq 'Staff'");
    return Response.json(managementRows);
  }
  if (url.pathname.endsWith('/api/dynamic-views/vw_Assets_All')) {
    assert.equal(url.searchParams.get('$filter'), "asset_Class eq 'Staff'");
    return Response.json(assetRows);
  }
  throw new Error(`Unexpected fetch: ${url}`);
};

const env = {
  SYNC_ADMIN_TOKEN: 'admin-test-token',
  OPERATIVE_CLIENT_ID: 'client-id',
  OPERATIVE_CLIENT_SECRET: 'client-secret'
};

const unauthorized = await worker.fetch(new Request(
  'https://worker.test/preview-physical-due'
), env);
assert.equal(unauthorized.status, 401);

const response = await worker.fetch(new Request(
  'https://worker.test/preview-physical-due?at=2026-08-04T13%3A00%3A00Z',
  { headers: { Authorization: 'Bearer admin-test-token' } }
), env);
assert.equal(response.status, 200);

const result = await response.json();
assert.equal(result.success, true);
assert.equal(result.mode, 'READ_ONLY_PHYSICAL_DUE_PREVIEW');
assert.equal(result.reportDate, '2026-08-04');
assert.equal(result.cutoffDate, '2026-09-03');
assert.equal(result.recordCount, 2);
assert.deepEqual(result.headers, ['Staff Member', 'Due For Physical']);
assert.deepEqual(result.sheetRows, [
  ['Past Due Member', '1/1/2026'],
  ['September Member', '9/1/2026']
]);
assert.equal(result.rows[0].overdue, true);
assert.equal(result.rows[1].daysUntilDue, 28);
assert.equal(result.diagnostics.duplicateStaffRecord, 1);
assert.equal(result.diagnostics.beyondThirtyDays, 1);
assert.equal(result.diagnostics.inactivePart, 1);
assert.equal(result.diagnostics.catalogPart, 1);
assert.equal(result.diagnostics.wrongAssetClass, 1);
assert.equal(result.diagnostics.missingDueDate, 1);

console.log('operative physical-due tests passed');
