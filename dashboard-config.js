/*
 * WTFD Fleet Dashboard - site settings
 *
 * Alert tone changes do not require editing script.js.
 * Replace the audio file and keep the same name, or update alertSoundUrl below.
 */
window.WTFD_DASHBOARD_CONFIG = {
  alertSoundEnabled: true,
  alertSoundUrl: 'sounds/dispatch-chime.wav',
  alertSoundVolume: 0.75,
  alertSoundPlayOncePerIncident: true,

  active911PopupDurationMs: 15000,
  // How long the incident location marker remains on the map.
  active911IncidentMarkerDurationMs: 10 * 60 * 1000,
  active911BannerDurationMs: 10 * 60 * 1000,
  dashboardRefreshMs: 10000,
  active911PollMs: 5000,
  connectionDelayedMs: 30000,
  connectionLostMs: 90000,
  kioskReloadAfterFailures: 12,

  // Standard dashboard opens one level closer than the boundary fit.
  standardServiceAreaZoomBoost: 1,
  standardServiceAreaMaxZoom: 14,

  // Kiosk-only service-area framing.
  kioskServiceAreaZoomBoost: 1,
  kioskServiceAreaMaxZoom: 14,
  kioskServiceAreaCenterShiftLon: 0.006
};
