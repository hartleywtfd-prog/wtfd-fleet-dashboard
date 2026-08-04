import assert from 'node:assert/strict';
import worker from '../workers/operative-preview.js';

const tickets = [
  {
    id: 101,
    createdDate: '2026-03-14T15:37:31Z',
    ticketName: 'roofing damage',
    truckId: 6,
    description: 'Shingles have pulled away.',
    status: 2,
    isClosed: false
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
  },
  {
    id: 104,
    createdDate: '2026-07-31T10:00:00Z',
    ticketName: 'Station door repair',
    truckId: 8,
    locationId: 2,
    description: 'The apparatus  door\r\nneeds service.',
    status: 2,
    isClosed: false
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
  if (url.pathname.endsWith('/api/desk-ticket-statuses')) {
    return Response.json([
      { id: 2, statusName: 'Open' },
      { id: 7, statusName: 'Pending' }
    ]);
  }
  if (url.pathname.endsWith('/api/service-desk-ticket-statuses')) {
    return Response.json([
      { id: 2, statusName: 'Open' },
      { id: 7, statusName: 'Pending' }
    ]);
  }
  if (url.pathname.endsWith('/api/units')) {
    return Response.json([
      { id: 6, truckNumber: 'F129' },
      { id: 8, truckNumber: 'Station 43' }
    ]);
  }
  if (url.pathname.endsWith('/api/unit-locations')) {
    return Response.json([{ id: 2, locationName: 'Station 43' }]);
  }
  if (url.pathname.endsWith('/api/service-desk-tickets/101/assigned-items')) {
    return Response.json([
      { id: 72, itemName: 'E42 DRIVER - Portable Radio (G)' },
      { id: 73, itemName: 'E42 FF B - Portable Radio (G)' }
    ]);
  }
  if (url.pathname.endsWith('/api/service-desk-tickets/104/assigned-items')) {
    return Response.json([]);
  }
  if (url.pathname.endsWith('/api/service-desk-tickets/331')) {
    return Response.json({
      emsDeskTicket: { id: 331, status: 2, isClosed: false },
      itemIds: [501, 502]
    });
  }
  if (url.pathname.endsWith('/api/service-desk-tickets/331/assigned-items')) {
    return Response.json([
      { id: 501, itemName: 'E42 DRIVER - Portable Radio (G)' },
      { id: 502, itemName: 'E42 FF B - Portable Radio (G)' }
    ]);
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
assert.equal(preview.openTicketCount, 2);
assert.equal(preview.recordCount, 3);
assert.deepEqual(preview.headers, [
  'Created', 'Asset Description', 'Ticket Name',
  'Unit Name', 'Description', 'Status'
]);
assert.deepEqual(preview.rows.map(row => row.ticketId), ['101', '101', '104']);
assert.equal(preview.rows[0].created, '03/14/2026');
assert.equal(preview.rows[0].assetDescription, 'E42 DRIVER - Portable Radio (G)');
assert.equal(preview.rows[1].assetDescription, 'E42 FF B - Portable Radio (G)');
assert.equal(preview.rows[1].unitName, 'Vehicle F129');
assert.equal(preview.rows[2].assetDescription, 'Station 43');
assert.equal(preview.rows[2].unitName, 'Station 43');
assert.equal(preview.rows[2].description, 'The apparatus door needs service.');
assert.equal(preview.rows[2].status, 'Open');

const blockedExport = await worker.fetch(new Request(
  'https://worker.test/export-open-service-tickets',
  { headers: { Authorization: 'Bearer admin-test-token' } }
), env);
assert.equal(blockedExport.status, 409);

const linkageResponse = await worker.fetch(new Request(
  'https://worker.test/probe-service-ticket-linkage?ticketId=331',
  { headers: { Authorization: 'Bearer admin-test-token' } }
), env);
assert.equal(linkageResponse.status, 200);
const linkage = await linkageResponse.json();
assert.equal(linkage.ticketId, 331);
assert.deepEqual(
  linkage.availableResources.find(item => item.path === '/api/service-desk-tickets/331')?.sample?.itemIds,
  [501, 502]
);
assert.equal(
  linkage.availableResources.find(item => item.path === '/api/desk-ticket-statuses')?.sample?.statusName,
  'Open'
);
assert.equal(
  linkage.availableResources.find(item => item.path === '/api/service-desk-tickets/331/assigned-items')?.returnedCount,
  2
);

console.log('operative-open-service-tickets tests passed');
