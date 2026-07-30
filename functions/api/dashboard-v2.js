export async function onRequestGet({ env }) {
  if (!env.DB) return json({ error: 'D1 binding DB is not configured.' }, 500);
  try {
    const [settingsResult, rowsResult] = await Promise.all([
      env.DB.prepare(`SELECT setting_key,setting_value FROM public_settings`).all(),
      env.DB.prepare(`
        SELECT v.raw_name,
               COALESCE(NULLIF(v.current_assignment,''),v.primary_assignment) AS display_name,
               v.vehicle_type,v.home_station,v.apparatus_number,
               s.samsara_name,s.latitude,s.longitude,s.gps_time,s.speed_mph,
               s.facility,s.current_location,s.gps_status,s.map_link,s.last_sync,
               s.emergency_lights,s.left_turn_signal,s.right_turn_signal,s.parked
        FROM vehicles v
        JOIN vehicle_state s ON s.apparatus_number=v.apparatus_number
        WHERE v.fleet_active=1 AND v.dashboard_visible=1
        ORDER BY v.apparatus_number
      `).all()
    ]);

    const rawSettings = Object.fromEntries(
      (settingsResult.results || []).map(row => [row.setting_key, row.setting_value])
    );
    const locations = (rowsResult.results || []).map(row => ({
      rawName: row.samsara_name || row.raw_name,
      unit: row.display_name,
      type: row.vehicle_type,
      homeStation: row.home_station,
      facility: row.facility,
      lat: Number(row.latitude),
      lon: Number(row.longitude),
      lastUpdate: row.gps_time || '',
      speed: Number(row.speed_mph || 0),
      location: row.current_location,
      gpsStatus: row.gps_status,
      mapLink: row.map_link || '',
      apparatusNumber: row.apparatus_number,
      lastSync: row.last_sync,
      emergencyLights: Boolean(row.emergency_lights),
      leftTurnSignal: Boolean(row.left_turn_signal),
      rightTurnSignal: Boolean(row.right_turn_signal),
      parked: Boolean(row.parked)
    }));

    return json({
      settings: {
        refreshSeconds: Number(rawSettings.RefreshSeconds || 60),
        dashboardCenterLat: Number(rawSettings.DashboardCenterLat || 39.62309),
        dashboardCenterLon: Number(rawSettings.DashboardCenterLon || -84.18822),
        dashboardZoom: Number(rawSettings.DashboardZoom || 12)
      },
      locations,
      diagnostics: diagnostics(locations)
    });
  } catch (error) {
    return json({ error: 'Unable to retrieve D1 fleet data.', detail: message(error) }, 500);
  }
}

function diagnostics(locations) {
  const now = Date.now();
  return {
    total: locations.length,
    gps: locations.filter(v => String(v.gpsStatus).toLowerCase() === 'gps').length,
    noGps: locations.filter(v => String(v.gpsStatus).toLowerCase() === 'no gps').length,
    stale: locations.filter(v => v.lastUpdate && now - new Date(v.lastUpdate).getTime() > 7200000).length,
    moving: locations.filter(v => Number(v.speed) >= 5).length,
    away: locations.filter(v => String(v.facility).toLowerCase() === 'away').length,
    emergency: locations.filter(v => {
      if (!v.emergencyLights) return false;
      const age = v.lastUpdate
        ? now - new Date(v.lastUpdate).getTime()
        : Infinity;
      if (age <= 900000) return true;
      const facility = String(v.facility || '').trim().toLowerCase();
      const atWtfdFacility = [
        'station 41', 'station 42', 'station 43', 'station 44', 'station 45',
        'headquarters', 'hq', 'fire maintenance'
      ].includes(facility);
      return !(Number(v.speed || 0) < 5 && atWtfdFacility);
    }).length,
    generatedAt: new Date().toISOString()
  };
}

function json(value, status = 200) {
  return Response.json(value, {
    status,
    headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0' }
  });
}

function message(error) {
  return error instanceof Error ? error.message : String(error);
}
