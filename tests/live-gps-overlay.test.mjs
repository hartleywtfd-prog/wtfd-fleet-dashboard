import assert from 'node:assert/strict';
import { test } from 'node:test';
import { overlayLiveGps } from '../functions/api/dashboard-v2.js';

const baseline = '2026-11-24T15:00:00Z';
const fresh = '2026-11-24T15:00:10Z';
const now = Date.parse('2026-11-24T15:00:15Z');

function units() {
  return [
    { samsaraVehicleId: 'id-engine', type: 'engine', lat:39.60,lon:-84.10,speed:0,lastUpdate:baseline,unit:'Engine 41' },
    { samsaraVehicleId: 'id-chief', type: 'chief', lat:39.61,lon:-84.11,speed:0,lastUpdate:baseline,unit:'Chief 41' }
  ];
}

test('live GPS changes only eligible positions, without writes', async () => {
  const rows = units();
  const result = await overlayLiveGps(rows, {
    DB: { prepare() { throw Error('No D1 operations allowed'); } },
    LIVE_GPS: { snapshot: async () => ({receivedAt:fresh,vehicles:[
      {vehicleId:'id-engine',lat:39.7,lon:-84.2,gpsTime:fresh,speedMph:43},
      {vehicleId:'id-chief',lat:39.8,lon:-84.3,gpsTime:fresh,speedMph:20}
    ]}) }
  }, now);
  assert.equal(result.updated,1);
  assert.equal(rows[0].lat,39.7);
  assert.equal(rows[0].speed,43);
  assert.equal(rows[0].lastUpdate,fresh);
  assert.equal(rows[1].lat,39.61);
});

test('older or stale points never replace D1 coordinates', async () => {
  const rows = units();
  const result = await overlayLiveGps(rows, {LIVE_GPS:{snapshot:async()=>({
    vehicles:[{vehicleId:'id-engine',lat:39.7,lon:-84.2,gpsTime:'2026-11-24T14:55:00Z',speedMph:40}]
  })}},now);
  assert.equal(result.updated,0);
  assert.equal(rows[0].lat,39.60);
});

test('unavailable live GPS returns metadata while retaining baseline', async () => {
  const rows=units();
  const result=await overlayLiveGps(rows,{LIVE_GPS:{snapshot:async()=>{throw Error('offline');}}},now);
  assert.equal(result.enabled,false);
  assert.equal(rows[0].lat,39.60);
});

test('missing live binding leaves original D1 positions intact', async () => {
  const rows=units();
  const result=await overlayLiveGps(rows,{},now);
  assert.equal(result.reason,'service-unavailable');
  assert.equal(rows[0].lat,39.60);
});
