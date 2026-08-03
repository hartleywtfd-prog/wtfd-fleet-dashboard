import assert from 'node:assert/strict';
import worker from '../workers/operative-preview.js';

globalThis.fetch = async input => {
  const url = new URL(String(input));
  if (url.hostname === 'auth.operativeiqfrontline.com') {
    return Response.json({ access_token: 'operative-test-token', expires_in: 3600 });
  }
  if (url.pathname.endsWith('/api/crews')) {
    return Response.json([
      {
        id: 10,
        employeeId: '100',
        firstName: 'Naymon',
        lastName: 'Blakey II',
        email: 'NBlakey@example.org',
        status: true
      },
      {
        id: 11,
        firstName: 'Inactive',
        lastName: 'Member',
        email: 'inactive@example.org',
        status: false
      },
      {
        id: 12,
        firstName: 'Missing',
        lastName: 'Email',
        email: '',
        status: true
      }
    ]);
  }
  throw new Error(`Unexpected fetch: ${url}`);
};

const response = await worker.fetch(new Request(
  'https://worker.test/preview-crew-emails',
  { headers: { Authorization: 'Bearer admin-test-token' } }
), {
  SYNC_ADMIN_TOKEN: 'admin-test-token',
  OPERATIVE_CLIENT_ID: 'client-id',
  OPERATIVE_CLIENT_SECRET: 'client-secret'
});

if (response.status !== 200) {
  throw new Error(`Crew preview failed (${response.status}): ${await response.text()}`);
}
const result = await response.json();
assert.equal(result.success, true);
assert.equal(result.mode, 'READ_ONLY_CREW_EMAIL_PREVIEW');
assert.equal(result.sourceRecordCount, 3);
assert.equal(result.activeEmailCount, 1);
assert.deepEqual(result.rows[0], {
  crewId: 10,
  employeeId: '100',
  firstName: 'Naymon',
  lastName: 'Blakey II',
  fullName: 'Naymon Blakey II',
  operativeLocationName: 'Blakey II Naymon',
  email: 'nblakey@example.org',
  status: true
});
assert.equal(result.diagnostics.inactive, 1);
assert.equal(result.diagnostics.missingOrInvalidEmail, 1);

console.log('operative crew email tests passed');
