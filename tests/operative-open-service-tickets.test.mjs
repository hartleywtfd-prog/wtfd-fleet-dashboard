import assert from 'node:assert/strict';
import worker from '../workers/operative-preview.js';

const tickets = [
  {
    id: 101,
    createdDate: '2026-03-14T15:37:31Z',
    assetDescription: 'Station 43',
    ticketName: 'roofing damage',
    unitName: 'Station 43',
    description: 'Shingles have pulled away.',
    status: 'Open'
  },
  {
    id: 102,
    createdDate: '2026-07-29T19:36:00Z',
    asset: { description: 'Vehicle F122' },
    subject: 'M44 multiple issues',
    unit: { unitName: 'Vehicle F122' },
    ticketDescription: 'Rear camera does not work.',
    ticketStatus: { name: 'Pending' }
  },
  {
    id: 103,
    createdDate: '2026-07-30T10:00:00Z',
    assetDescription: 'Vehicle F129',
    ticketName: 'Completed repair',
    unitName: 'Vehicle F129',
    description: 'Repair finished.',
    status: 6,
    isClosed: true
  }
];

globalThis.fetch = async input => {
  const url = new URL(String(input));
  if (url.hostname === 'auth.operativeiqfrontline.com') {
    return Response.json({ access_token: 'operative-test-token', expires_in: 3600 });
  }
  if (url.pathname.endsWith('/swagger/v1/swagger.json')) {
    return Response.json({
      components: {
        schemas: {
          EmsDeskTicket: {
            properties: {
              id: {}, createdTime: {}, itemId: {}, ticketName: {},
              truckId: {}, ticketDescription: {}, status: {}, isClosed: {}
            }
          }
        }
      }
    });
  }
  if (/\/swagger|\/openapi\.json$/.test(url.pathname)) {
    return new Response('not found', { status: 404 });
  }
  if (url.pathname.endsWith('/api/desk-tickets')) return Response.json(tickets);
  if (url.hostname === 'client.operativeiqfrontline.com' && url.pathname.startsWith('/FrontlineV_live/api/')) {
    return new Response(JSON.stringify({ error: 'not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  throw new Error(`Unexpected fetch: ${url}`);
};

const env = {
  SYNC_ADMIN_TOKEN: 'admin-test-token',
  OPERATIVE_CLIENT_ID: 'client-id',
  OPERATIVE_CLIENT_SECRET: 'client-secret'
};

const unauthorized = await worker.fetch(new Request(
  'https://worker.test/open-service-tickets'
), env);
assert.equal(unauthorized.status, 401);

const response = await worker.fetch(new Request(
  'https://worker.test/open-service-tickets',
  { headers: { Authorization: 'Bearer admin-test-token' } }
), env);
assert.equal(response.status, 200);
const preview = await response.json();
assert.equal(preview.endpoint, '/api/desk-tickets');
assert.equal(preview.endpointSource, 'SWAGGER_AUTO_DISCOVERY');
assert.equal(preview.recordCount, 2);
assert.deepEqual(preview.headers, [
  'Created', 'Asset Description', 'Ticket Name',
  'Unit Name', 'Description', 'Status'
]);
assert.deepEqual(preview.rows.map(row => row.ticketId), ['101', '102']);
assert.equal(preview.rows[0].created, '03/14/2026');
assert.equal(preview.rows[1].assetDescription, 'Vehicle F122');
assert.equal(preview.rows[1].unitName, 'Vehicle F122');
assert.equal(preview.rows[1].status, 'Pending');

const blockedExport = await worker.fetch(new Request(
  'https://worker.test/export-open-service-tickets',
  { headers: { Authorization: 'Bearer admin-test-token' } }
), env);
assert.equal(blockedExport.status, 409);

console.log('operative-open-service-tickets tests passed');
