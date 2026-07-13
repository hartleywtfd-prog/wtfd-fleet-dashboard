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
  active911BannerDurationMs: 10 * 60 * 1000,
  dashboardRefreshMs: 30000,
  active911PollMs: 5000
};
