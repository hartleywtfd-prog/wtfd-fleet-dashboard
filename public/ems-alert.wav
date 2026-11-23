export async function onRequestGet({ request }) {
  const base = new URL(request.url);
  try {
    const [legacyResponse, d1Response] = await Promise.all([
      fetch(new URL('/api/dashboard', base), { headers: { Accept: 'application/json' } }),
      fetch(new URL('/api/dashboard-v2', base), { headers: { Accept: 'application/json' } })
    ]);
    const legacy = await legacyResponse.json();
    const d1 = await d1Response.json();
    if (!legacyResponse.ok || !d1Response.ok) {
      return Response.json({ error: 'One comparison source failed.', legacy, d1 }, { status: 502 });
    }
    const oldByNumber = new Map((legacy.locations || []).map(v => [v.apparatusNumber, v]));
    const newByNumber = new Map((d1.locations || []).map(v => [v.apparatusNumber, v]));
    const numbers = [...new Set([...oldByNumber.keys(), ...newByNumber.keys()])].sort();
    const vehicles = numbers.map(number => compare(number, oldByNumber.get(number), newByNumber.get(number)));
    return Response.json({
      comparedAt: new Date().toISOString(),
      legacyCount: oldByNumber.size,
      d1Count: newByNumber.size,
      matching: vehicles.filter(v => v.result === 'match').length,
      differences: vehicles.filter(v => v.result !== 'match'),
      vehicles
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return Response.json({ error: 'Comparison failed.', detail: String(error) }, { status: 500 });
  }
}

function compare(number, legacy, d1) {
  if (!legacy) return { apparatusNumber: number, result: 'missing-legacy' };
  if (!d1) return { apparatusNumber: number, result: 'missing-d1' };
  const distance = distanceFeet(legacy.lat, legacy.lon, d1.lat, d1.lon);
  const differences = [];
  if (distance > 100) differences.push(`location ${Math.round(distance)} ft`);
  for (const key of ['unit','facility','gpsStatus','emergencyLights']) {
    if (String(legacy[key]) !== String(d1[key])) {
      differences.push(`${key}: ${String(legacy[key])} → ${String(d1[key])}`);
    }
  }
  // Parked is a new optional field. Compare it only when the deployed legacy
  // endpoint already exposes it; an absent legacy value is not a data mismatch.
  if (legacy.parked !== undefined && String(legacy.parked) !== String(d1.parked)) {
    differences.push(`parked: ${String(legacy.parked)} → ${String(d1.parked)}`);
  }
  return { apparatusNumber: number, result: differences.length ? 'different' : 'match', distanceFeet: Math.round(distance), differences };
}

function distanceFeet(lat1, lon1, lat2, lon2) {
  if (![lat1,lon1,lat2,lon2].every(value => Number.isFinite(Number(value)))) return Infinity;
  const rad = degrees => degrees * Math.PI / 180;
  const dLat = rad(Number(lat2) - Number(lat1));
  const dLon = rad(Number(lon2) - Number(lon1));
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(Number(lat1))) * Math.cos(rad(Number(lat2))) * Math.sin(dLon / 2) ** 2;
  return 20902231 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
