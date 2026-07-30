const SAMSARA_URL = 'https://api.samsara.com/fleet/vehicles/stats';
const SAMSARA_TYPES = ['gps', 'auxInput1', 'auxInput2', 'auxInput3', 'auxInput4'];

export default {
  async scheduled(_controller, env, ctx) {
    ctx.waitUntil(runSync(env).catch(error => {
      console.error('Samsara synchronization failed:', errorMessage(error));
      throw error;
    }));
  },

  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname !== '/sync') return new Response('Not found', { status: 404 });
    if (request.headers.get('Authorization') !== `Bearer ${env.SYNC_ADMIN_TOKEN}`) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    try {
      return Response.json(await runSync(env));
    } catch (error) {
      return Response.json({ error: errorMessage(error) }, { status: 500 });
    }
  }
};

async function runSync(env) {
  if (!env.SAMSARA_TOKEN) throw new Error('SAMSARA_TOKEN is not configured.');
  const startedAt = new Date().toISOString();
  const run = await env.DB.prepare(
    `INSERT INTO sync_runs(started_at,status) VALUES(?,'running') RETURNING id`
  ).bind(startedAt).first();

  try {
    const [vehiclesResult, facilitiesResult] = await Promise.all([
      env.DB.prepare(
        `SELECT * FROM vehicles WHERE fleet_active=1 AND dashboard_visible=1 ORDER BY apparatus_number`
      ).all(),
      env.DB.prepare(`SELECT * FROM facilities`).all()
    ]);
    const samsara = await getSamsaraSnapshot(env.SAMSARA_TOKEN);
    const facilities = facilitiesResult.results || [];
    const syncTime = new Date().toISOString();
    const matchedIds = new Set();
    const writes = [];

    for (const unit of vehiclesResult.results || []) {
      const vehicle = findVehicle(samsara, unit);
      if (vehicle && vehicle.id) matchedIds.add(String(vehicle.id));
      const gps = latest(vehicle && vehicle.gps);
      const lights = aux(vehicle, 1);
      const left = aux(vehicle, 2);
      const right = aux(vehicle, 3);
      const parked = aux(vehicle, 4);
      let state;

      if (gps && validCoordinate(gps.latitude) && validCoordinate(gps.longitude)) {
        const lat = Number(gps.latitude);
        const lon = Number(gps.longitude);
        const speed = Number(gps.speedMilesPerHour || 0);
        const location =
          (gps.address && gps.address.name) ||
          (gps.reverseGeo && gps.reverseGeo.formattedLocation) ||
          'Unknown';
        const resolved = resolveFacility(
          lat, lon, String(location).trim(), unit.home_station,
          unit.vehicle_type, speed, facilities
        );
        state = {
          lat: resolved.latitude, lon: resolved.longitude, gpsTime: gps.time || '',
          speed, facility: resolved.facility, location: resolved.currentLocation,
          gpsStatus: 'GPS'
        };
      } else {
        const home = facilities.find(item => item.facility_key === unit.home_station);
        state = home ? {
          lat: Number(home.latitude), lon: Number(home.longitude), gpsTime: '',
          speed: 0, facility: home.display_name, location: home.display_name,
          gpsStatus: 'No GPS'
        } : {
          lat: null, lon: null, gpsTime: '', speed: 0, facility: 'Unknown',
          location: unit.home_station || 'Unknown', gpsStatus: 'No GPS'
        };
      }

      writes.push(env.DB.prepare(`
        INSERT INTO vehicle_state (
          apparatus_number,samsara_vehicle_id,samsara_name,latitude,longitude,
          gps_time,speed_mph,facility,current_location,gps_status,map_link,
          emergency_lights,left_turn_signal,right_turn_signal,parked,last_sync
        ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        ON CONFLICT(apparatus_number) DO UPDATE SET
          samsara_vehicle_id=excluded.samsara_vehicle_id,
          samsara_name=excluded.samsara_name,
          latitude=excluded.latitude, longitude=excluded.longitude,
          gps_time=excluded.gps_time, speed_mph=excluded.speed_mph,
          facility=excluded.facility, current_location=excluded.current_location,
          gps_status=excluded.gps_status, map_link=excluded.map_link,
          emergency_lights=excluded.emergency_lights,
          left_turn_signal=excluded.left_turn_signal,
          right_turn_signal=excluded.right_turn_signal,
          parked=excluded.parked, last_sync=excluded.last_sync
      `).bind(
        unit.apparatus_number, vehicle?.id || null, vehicle?.name || unit.raw_name,
        state.lat, state.lon, state.gpsTime, state.speed, state.facility,
        state.location, state.gpsStatus, mapLink(state.lat, state.lon),
        lights ? 1 : 0, left ? 1 : 0, right ? 1 : 0, parked ? 1 : 0, syncTime
      ));
    }

    if (writes.length) await env.DB.batch(writes);
    const unmatched = samsara
      .filter(vehicle => !matchedIds.has(String(vehicle.id)))
      .map(vehicle => ({ id: vehicle.id || '', name: vehicle.name || '' }));
    await env.DB.prepare(`
      UPDATE sync_runs SET completed_at=?,status='success',vehicle_count=?,unmatched_json=?
      WHERE id=?
    `).bind(new Date().toISOString(), writes.length, JSON.stringify(unmatched), run.id).run();
    return { success: true, vehicleCount: writes.length, unmatched, timestamp: syncTime };
  } catch (error) {
    await env.DB.prepare(`
      UPDATE sync_runs SET completed_at=?,status='failed',error_message=? WHERE id=?
    `).bind(new Date().toISOString(), errorMessage(error), run.id).run();
    throw error;
  }
}

async function getSamsaraSnapshot(token) {
  const pages = await Promise.all(
    SAMSARA_TYPES.map(type => getSnapshotType(token, type))
  );
  const merged = new Map();
  for (const page of pages) {
    for (const vehicle of page) {
      const id = String(vehicle.id || '');
      if (!id) continue;
      merged.set(id, { ...(merged.get(id) || {}), ...vehicle });
    }
  }
  return [...merged.values()];
}

async function getSnapshotType(token, type) {
  const vehicles = [];
  let after = '';
  do {
    const url = new URL(SAMSARA_URL);
    url.searchParams.set('types', type);
    if (after) url.searchParams.set('after', after);
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' }
    });
    const text = await response.text();
    if (!response.ok) throw new Error(`Samsara API error ${response.status}: ${text}`);
    const body = JSON.parse(text);
    vehicles.push(...(body.data || []));
    const pagination = body.pagination || {};
    after = pagination.hasNextPage ? String(pagination.endCursor || '') : '';
  } while (after);
  return vehicles;
}

function latest(values) {
  if (!values) return null;
  if (!Array.isArray(values)) return values;
  if (!values.length) return null;
  return [...values].sort((a, b) => new Date(b.time || 0) - new Date(a.time || 0))[0];
}

function aux(vehicle, number) {
  const value = latest(vehicle && vehicle[`auxInput${number}`]);
  return normalizeBoolean(value && value.value);
}

function normalizeBoolean(value) {
  if (value === true) return true;
  return ['TRUE', '1', 'YES', 'Y', 'ON'].includes(String(value || '').trim().toUpperCase());
}

function apparatusNumber(text) {
  const match = String(text || '').toUpperCase().match(/\bF\d{2,4}\b/);
  return match ? match[0] : '';
}

function normalize(text) {
  return String(text || '').trim().toUpperCase().replace(/\s+/g, ' ');
}

function findVehicle(vehicles, unit) {
  const raw = normalize(unit.raw_name);
  return vehicles.find(vehicle => normalize(vehicle.name) === raw) ||
    vehicles.find(vehicle => apparatusNumber(vehicle.name) === unit.apparatus_number) ||
    null;
}

function validCoordinate(value) {
  return value !== '' && value !== null && value !== undefined && Number.isFinite(Number(value));
}

function distanceFeet(lat1, lon1, lat2, lon2) {
  const rad = degrees => degrees * Math.PI / 180;
  const earthFeet = 20902231;
  const dLat = rad(lat2 - lat1);
  const dLon = rad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLon / 2) ** 2;
  return earthFeet * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function facilityNamed(facility, name) {
  const target = normalize(name);
  return normalize(facility.facility_key) === target || normalize(facility.display_name) === target;
}

function operationalType(type) {
  return ['ENGINE','MEDIC','LADDER','BATTALION','BRUSH','RESCUE','TANKER','SQUAD']
    .includes(normalize(type));
}

function selectedFacility(facility) {
  return {
    facility: facility.display_name,
    latitude: Number(facility.latitude),
    longitude: Number(facility.longitude),
    currentLocation: facility.display_name
  };
}

function resolveFacility(lat, lon, samsaraLocation, _home, type, speed, facilities) {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return { facility: 'Away', latitude: lat, longitude: lon, currentLocation: samsaraLocation || 'Unknown' };
  }
  const matches = [];
  if (Number(speed || 0) < 10) {
    for (const facility of facilities) {
      const distance = distanceFeet(lat, lon, Number(facility.latitude), Number(facility.longitude));
      if (distance <= Number(facility.radius_feet || 0)) {
        const location = normalize(samsaraLocation);
        matches.push({
          facility, distance,
          textMatch: location.includes(normalize(facility.facility_key)) ||
            location.includes(normalize(facility.display_name))
        });
      }
    }
  }
  if (!matches.length) {
    return { facility: 'Away', latitude: lat, longitude: lon, currentLocation: samsaraLocation || 'Unknown' };
  }
  const maintenance = matches.find(match => facilityNamed(match.facility, 'Fire Maintenance'));
  if (maintenance) return selectedFacility(maintenance.facility);
  const headquarters = matches.find(match => facilityNamed(match.facility, 'Headquarters'));
  const station45 = matches.find(match => facilityNamed(match.facility, 'Station 45'));
  if (headquarters && station45) {
    return selectedFacility((operationalType(type) ? station45 : headquarters).facility);
  }
  matches.sort((a, b) => {
    const difference = a.distance - b.distance;
    if (Math.abs(difference) > 75) return difference;
    if (a.textMatch !== b.textMatch) return a.textMatch ? -1 : 1;
    return difference;
  });
  return selectedFacility(matches[0].facility);
}

function mapLink(lat, lon) {
  return validCoordinate(lat) && validCoordinate(lon) ? `https://www.google.com/maps?q=${lat},${lon}` : '';
}

function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}
