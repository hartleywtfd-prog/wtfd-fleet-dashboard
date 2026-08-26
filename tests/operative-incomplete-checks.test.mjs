import assert from 'node:assert/strict';
import worker, { planIncompleteCheckChanges } from '../workers/operative-preview.js';

const states = [
  state(1, 100, 'Daily Engine', 1, 1),
  state(2, 100, 'Friday Station Duties', 1, 1),
  state(3, 100, 'UTV 44 Check List', 1, 2, { sunday: true }),
  state(4, 101, 'UTV 41 Check List', 1, 2, { monday: true }),
  state(5, 101, 'Daily Engine', 3, 1),
  state(6, 101, 'Daily Engine', 1, 1),
  state(7, 102, 'Daily Engine', 1, 1)
];

const shifts = [
  { id: 100, truckId: 10, entryDate: '2026-08-02', entryTime: '07:00:00', status: true },
  { id: 101, truckId: 11, entryDate: '2026-08-03', entryTime: '07:00:00', status: true },
  { id: 102, truckId: 12, entryDate: '2026-08-03', entryTime: '07:00:00', status: true }
];

const units = [
  { id: 10, truckNumber: 'Vehicle F110', truckStatusId: 1, locationId: 20 },
  { id: 11, truckNumber: 'Vehicle F111', truckStatusId: 1, locationId: 20 },
  { id: 12, truckNumber: 'Vehicle F112', truckStatusId: 2, locationId: 20 }
];

globalThis.fetch = async input => {
  const url = new URL(String(input));
  if (url.hostname === 'auth.operativeiqfrontline.com') {
    return Response.json({ access_token: 'operative-test-token', expires_in: 3600 });
  }
  if (url.pathname.endsWith('/api/daily-shift-questionaries-state')) return Response.json(states);
  if (url.pathname.endsWith('/api/daily-shifts')) return Response.json(shifts);
  if (url.pathname.endsWith('/api/units')) return Response.json(units);
  if (url.pathname.endsWith('/api/unit-statuses')) {
    return Response.json([
      { id: 1, truckStatusName: 'In-Service' },
      { id: 2, truckStatusName: 'Out of Service' }
    ]);
  }
  if (url.pathname.endsWith('/api/unit-locations')) {
    return Response.json([{ id: 20, locationName: 'Station 41' }]);
  }
  throw new Error(`Unexpected fetch: ${url}`);
};

const env = {
  SYNC_ADMIN_TOKEN: 'admin-test-token',
  OPERATIVE_CLIENT_ID: 'client-id',
  OPERATIVE_CLIENT_SECRET: 'client-secret',
  DB: {
    prepare(sql) {
      assert.match(sql, /FROM vehicles/);
      return {
        async all() {
          return {
            results: [
              { apparatus_number: 'F110', primary_assignment: 'Engine 41', current_assignment: 'Engine 41' },
              { apparatus_number: 'F111', primary_assignment: 'Engine 42', current_assignment: 'Engine 42' },
              { apparatus_number: 'F112', primary_assignment: 'Engine 43', current_assignment: 'Engine 43' }
            ]
          };
        }
      };
    }
  }
};

const beforeChange = await preview('2026-08-03T10:59:00Z');
assert.equal(beforeChange.shiftKey, '2026-08-02');
assert.deepEqual(
  beforeChange.rows.map(row => row.questionnaireName).sort(),
  ['Daily Engine', 'UTV 44 Check List']
);

const atChange = await preview('2026-08-03T11:00:00Z');
assert.equal(atChange.shiftKey, '2026-08-03');
assert.deepEqual(
  atChange.rows.map(row => row.questionnaireName).sort(),
  ['Daily Engine', 'Daily Engine', 'UTV 41 Check List', 'UTV 44 Check List']
);
assert.equal(atChange.rows.some(row => row.unitNumber === 'Vehicle F112'), false);

const blockedD1 = await worker.fetch(new Request(
  'https://worker.test/sync-incomplete-checks',
  { headers: { Authorization: 'Bearer admin-test-token' } }
), env);
assert.equal(blockedD1.status, 409);

const blockedSheets = await worker.fetch(new Request(
  'https://worker.test/export-incomplete-checks',
  { headers: { Authorization: 'Bearer admin-test-token' } }
), env);
assert.equal(blockedSheets.status, 409);

const unchangedPlan = planIncompleteCheckChanges({
  shiftKey: '2026-08-03',
  rows: [{
    stateId: 6,
    shiftId: 101,
    truckId: 11,
    questionaryId: 1006,
    date: '2026-08-03',
    locationName: 'Station 41',
    unitNumber: 'Vehicle F111',
    inServiceStatus: 'In-Service',
    questionnaireName: 'Daily Engine',
    status: 'Not Completed'
  }]
}, [{
  shift_key: '2026-08-03',
  state_id: 6,
  shift_id: 101,
  truck_id: 11,
  questionary_id: 1006,
  report_date: '2026-08-03',
  location_name: 'Station 41',
  unit_number: 'Vehicle F111',
  in_service_status: 'In-Service',
  questionnaire_name: 'Daily Engine',
  check_status: 'Not Completed'
}]);
assert.equal(unchangedPlan.changed, false);
assert.equal(unchangedPlan.unchangedCount, 1);

const changedPlan = planIncompleteCheckChanges({
  shiftKey: '2026-08-03',
  rows: [{
    stateId: 7,
    shiftId: 102,
    truckId: 12,
    questionaryId: 1007,
    date: '2026-08-03',
    locationName: 'Station 42',
    unitNumber: 'Vehicle F112',
    inServiceStatus: 'In-Service',
    questionnaireName: 'Daily Engine',
    status: 'Not Completed'
  }]
}, [{ state_id: 6 }]);
assert.equal(changedPlan.changed, true);
assert.equal(changedPlan.upserts.length, 1);
assert.deepEqual(changedPlan.deletedStateIds, [6]);

console.log('operative-incomplete-checks tests passed');

async function preview(at) {
  const response = await worker.fetch(new Request(
    `https://worker.test/preview-current-incomplete-checks?at=${encodeURIComponent(at)}`,
    { headers: { Authorization: 'Bearer admin-test-token' } }
  ), env);
  if (response.status !== 200) {
    throw new Error(`Preview failed (${response.status}): ${await response.text()}`);
  }
  return response.json();
}

function state(id, shiftId, questionaryName, currentState, schedulerType, extra = {}) {
  return {
    id,
    shiftId,
    questionaryId: id + 1000,
    questionaryName,
    status: true,
    isScheduled: true,
    currentState,
    schedulerType,
    ...extra
  };
}
