import assert from 'node:assert/strict';
import worker from '../workers/operative-preview.js';

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
  OPERATIVE_CLIENT_SECRET: 'client-secret'
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
  ['Daily Engine', 'UTV 41 Check List']
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
