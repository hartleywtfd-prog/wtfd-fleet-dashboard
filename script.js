/* ===== User-adjustable dashboard settings ===== */
const DASHBOARD_CONFIG = {
  version: '4.4.3',
  // Fallback map view used only if the jurisdiction boundary cannot load.
  defaultCenterLat: 39.62784,
  defaultCenterLon: -84.15996,
  minimumMapZoom: 13,

  // WTFD jurisdiction boundary from ArcGIS Online.
  serviceAreaQueryUrl:
    'https://services3.arcgis.com/zfU4OP7x8VRbXrlu/arcgis/rest/services/' +
    'WTFD_Service_Area/FeatureServer/0/query' +
    '?where=1%3D1&outFields=*&returnGeometry=true&outSR=4326&f=geojson',
  fitMapToServiceArea: true,
  serviceAreaMaxZoom: 13,
  // Standard dashboard framing: use the natural jurisdiction-boundary fit.
  standardServiceAreaZoomBoost: 0,
  standardServiceAreaMaxZoom: 13,
  // Kiosk-only framing: one level tighter with a slight eastward center shift.
  kioskServiceAreaZoomBoost: 0,
  kioskServiceAreaFitPadding: 50,
  kioskServiceAreaMaxZoom: 14,
  kioskServiceAreaCenterShiftLon: 0.006,

  dashboardRefreshMs: 10000,
  active911PollMs: 5000,
  active911PopupDurationMs: 15000,
  active911IncidentMarkerDurationMs: 10 * 60 * 1000,
  active911BannerDurationMs: 10 * 60 * 1000,
  active911BannerMaxItems: 5,
  active911StartupPopupMaxAgeMs: 2 * 60 * 1000,
  active911TimeZone: 'America/New_York',
  reconnectRetryMs: 5000,
  cacheKey: 'wtfd-dashboard-cache-v2',
  kioskIncidentFocusMs: 15000,

  // Kiosk-mode settings. Enable by adding ?mode=kiosk to the URL.
  kioskAutoReloadMs: 6 * 60 * 60 * 1000,
  kioskHomeResetMs: 10 * 60 * 1000,
  kioskCursorHideMs: 5000,
  connectionDelayedMs: 30 * 1000,
  connectionLostMs: 90 * 1000,
  kioskReloadAfterFailures: 12,

  // Active911 audible alert. These values can be overridden in dashboard-config.js.
  alertSoundEnabled: true,
  alertSoundUrl: 'sounds/dispatch-chime.wav',
  alertSoundVolume: 0.75,
  alertSoundPlayOncePerIncident: true,
  alertSoundStorageKey: 'wtfd-last-audible-active911-id',

  // Regular-site Fleet Health integration. Kiosk mode does not request it.
  fleetHealthDashboardUrl: 'https://wtfd-fleet-health.pages.dev/',
  fleetHealthApiUrl: 'https://wtfd-fleet-health.pages.dev/api/fleet-health',
  fleetHealthRefreshMs: 60 * 1000
};

Object.assign(
  DASHBOARD_CONFIG,
  window.WTFD_DASHBOARD_CONFIG || {}
);

const DASHBOARD_MODE =
  new URLSearchParams(window.location.search)
    .get('mode')
    ?.toLowerCase() === 'kiosk'
    ? 'kiosk'
    : 'interactive';

const IS_KIOSK_MODE = DASHBOARD_MODE === 'kiosk';

document.body.classList.toggle('kiosk-mode', IS_KIOSK_MODE);
const IS_AMAZON_SILK = /Silk\//i.test(navigator.userAgent || '');
document.body.classList.toggle('silk-browser', IS_AMAZON_SILK);
document.documentElement.dataset.dashboardMode = DASHBOARD_MODE;

// Amazon Silk does not consistently route Fire TV remote scrolling to nested
// overflow containers unless the container can receive focus.
if (IS_KIOSK_MODE && IS_AMAZON_SILK) {
  window.addEventListener('load', () => {
    const sidebar = document.getElementById('sidebar');
    if (!sidebar) return;
    sidebar.tabIndex = 0;
    sidebar.setAttribute('aria-label', 'Command display status ribbon');
    try { sidebar.focus({ preventScroll: true }); } catch (_) { sidebar.focus(); }
  });
}

document.addEventListener('DOMContentLoaded', () => {
  const version = document.getElementById('dashboardVersion');
  if (version) version.textContent = `v${DASHBOARD_CONFIG.version}`;
});

let map;
let markers = {};
let allLocations = [];
let activeBaseLayer = 'street';
let baseLayers = {};
let serviceAreaLayer = null;
let serviceAreaViewApplied = false;
let homeMapView = null;
let lastSuccessfulDashboardRefresh = 0;
let kioskCursorTimer = null;
let activeIncidentMarker = null;
let activeIncidentMarkerTimer = null;
let activeIncidentKey = '';
let activeIncidentAlert = null;
let currentRespondingUnits = [];
let lastRefreshDisplayTimer = null;
let activeIncidents = [];
// Preserve one stable start time per incident across repeated Active911 polls.
// Without this cache, an invalid/future source timestamp can reset to Date.now()
// on every poll, leaving the elapsed timer near 0:00 and preventing expiration.
const incidentStartTimes = new Map();
let reconnectRetryTimer = null;
let preferredAutomaticLayer = '';
let lastDashboardSettings = {};
let dashboardRequestInFlight = false;
let consecutiveDashboardFailures = 0;
let nextReconnectAttemptAt = 0;
let reconnectCountdownTimer = null;
let previousConnectionState = 'online';
let recoveryToastTimer = null;
let fleetHealthByApparatus = new Map();
let fleetHealthRequestInFlight = false;

function showRecoveryToast() {
  const toast = document.getElementById('connectionRestoredToast');
  if (!toast) return;
  toast.hidden = false;
  clearTimeout(recoveryToastTimer);
  recoveryToastTimer = setTimeout(() => {
    toast.hidden = true;
  }, 5000);
}

function formatConnectionAge(ageMs) {
  const seconds = Math.max(0, Math.floor(ageMs / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  const remaining = seconds % 60;
  return `${minutes}m ${remaining}s ago`;
}

function setConnectionState(state, message) {
  const indicator = document.getElementById('connectionStatus');
  const banner = document.getElementById('connectionWarning');
  const kioskState = document.getElementById('kioskConnectionState');

  if (previousConnectionState !== 'online' && state === 'online') {
    showRecoveryToast();
  }
  previousConnectionState = state;

  if (indicator) {
    indicator.className = `connected connection-${state}`;
    indicator.textContent = message;
  }

  if (kioskState) {
    kioskState.className = `connection-${state}`;
    kioskState.textContent = state === 'online'
      ? '● LIVE'
      : state === 'delayed'
        ? '● DELAYED'
        : '● OFFLINE';
  }

  if (banner) {
    banner.hidden = state !== 'lost';
    banner.textContent = state === 'lost'
      ? 'CONNECTION LOST — DISPLAYED DATA MAY BE OUT OF DATE'
      : '';
  }
}

function recordSuccessfulDashboardRefresh() {
  lastSuccessfulDashboardRefresh = Date.now();
  consecutiveDashboardFailures = 0;
  setConnectionState('online', '● LIVE — updated now');
}

function saveHomeMapView() {
  if (!map) return;

  homeMapView = {
    center: map.getCenter(),
    zoom: map.getZoom()
  };
}

function returnToHomeView() {
  if (!IS_KIOSK_MODE || !map || !homeMapView) return;

  map.setView(homeMapView.center, homeMapView.zoom, {
    animate: false
  });
}

function configureKioskMap() {
  if (!IS_KIOSK_MODE || !map) return;

  map.dragging.disable();
  map.scrollWheelZoom.disable();
  map.doubleClickZoom.disable();
  map.boxZoom.disable();
  map.keyboard.disable();
  map.touchZoom.disable();

  if (map.tap) {
    map.tap.disable();
  }
}

function showKioskCursorTemporarily() {
  if (!IS_KIOSK_MODE) return;

  document.body.classList.remove('kiosk-cursor-hidden');

  if (kioskCursorTimer) {
    clearTimeout(kioskCursorTimer);
  }

  kioskCursorTimer = setTimeout(() => {
    document.body.classList.add('kiosk-cursor-hidden');
  }, DASHBOARD_CONFIG.kioskCursorHideMs);
}

function apiRequest(action) {
  const endpoint = action === 'sync' ? '/api/sync' : '/api/dashboard';
  const separator = endpoint.includes('?') ? '&' : '?';
  const url = `${endpoint}${separator}_=${Date.now()}`;

  return fetch(url, {
    cache: 'no-store',
    headers: {
      'Cache-Control': 'no-cache, no-store, max-age=0',
      'Pragma': 'no-cache'
    }
  }).then(response => {
    if (!response.ok) {
      throw new Error('API request failed: ' + response.status);
    }

    return response.json();
  });
}


function clearLegacyDarkThemeState() {
  document.documentElement.classList.remove('dark-mode', 'night-mode', 'map-dark');
  document.body.classList.remove('dark-mode', 'night-mode', 'map-dark');

  [
    'mapTheme',
    'map-theme',
    'preferredMapLayer',
    'preferred-map-layer',
    'dashboardTheme',
    'dashboard-theme'
  ].forEach(key => {
    try { localStorage.removeItem(key); } catch (_) {}
  });
}

clearLegacyDarkThemeState();

function createBaseLayers() {
  baseLayers = {
    street: L.tileLayer(
      'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
      {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap'
      }
    ),


    satellite: L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      {
        maxZoom: 19,
        attribution:
          'Tiles &copy; Esri'
      }
    )
  };
}

function initMap(settings) {
  const centerLat = Number(
    settings.dashboardCenterLat || DASHBOARD_CONFIG.defaultCenterLat
  );

  const centerLon = Number(
    settings.dashboardCenterLon || DASHBOARD_CONFIG.defaultCenterLon
  );

  // Keep the dashboard focused more tightly on the response area.
  // Use at least zoom level 13 even if the backend still returns 12.
  const configuredZoom = Number(
    settings.dashboardZoom || DASHBOARD_CONFIG.minimumMapZoom
  );

  const zoom = Math.max(
    configuredZoom,
    DASHBOARD_CONFIG.minimumMapZoom
  );

  map = L.map('map', {
    zoomControl: true
  }).setView(
    [centerLat, centerLon],
    zoom
  );

  createBaseLayers();
  preferredAutomaticLayer = 'street';
  baseLayers.street.addTo(map);
  activeBaseLayer = 'street';

  configureKioskMap();

  // Recalculate compact overlap layouts immediately when the user changes
  // zoom. A short debounce prevents repeated redraws during animated zooms.
  let markerLayoutTimer = null;
  map.on('zoomend', () => {
    clearTimeout(markerLayoutTimer);
    markerLayoutTimer = setTimeout(() => {
      if (allLocations && allLocations.length) renderDashboard(allLocations);
    }, 60);
  });

  saveHomeMapView();
  loadServiceAreaBoundary();
}

function loadServiceAreaBoundary() {
  if (!map || !DASHBOARD_CONFIG.serviceAreaQueryUrl) {
    return;
  }

  fetch(DASHBOARD_CONFIG.serviceAreaQueryUrl, {
    cache: 'no-store'
  })
    .then(response => {
      if (!response.ok) {
        throw new Error(
          'Service-area request failed: ' + response.status
        );
      }

      return response.json();
    })
    .then(geojson => {
      if (
        !geojson ||
        !Array.isArray(geojson.features) ||
        geojson.features.length === 0
      ) {
        throw new Error('No service-area geometry was returned.');
      }

      if (serviceAreaLayer) {
        map.removeLayer(serviceAreaLayer);
      }

      serviceAreaLayer = L.geoJSON(geojson, {
        interactive: false,
        style: {
          color: '#dc2626',
          weight: 3,
          opacity: 0.9,
          fillColor: '#dc2626',
          fillOpacity: 0.14
        }
      }).addTo(map);

      // Keep the jurisdiction outline below apparatus markers.
      serviceAreaLayer.bringToBack();

      const bounds = serviceAreaLayer.getBounds();

      if (
        DASHBOARD_CONFIG.fitMapToServiceArea &&
        !serviceAreaViewApplied &&
        bounds.isValid()
      ) {
        const serviceAreaFitPadding = IS_KIOSK_MODE
          ? Number(DASHBOARD_CONFIG.kioskServiceAreaFitPadding || 50)
          : 30;

        map.fitBounds(bounds, {
          paddingTopLeft: [serviceAreaFitPadding, serviceAreaFitPadding],
          paddingBottomRight: [serviceAreaFitPadding, serviceAreaFitPadding],
          maxZoom: DASHBOARD_CONFIG.serviceAreaMaxZoom,
          animate: false
        });

        const fittedCenter = map.getCenter();

        if (IS_KIOSK_MODE) {
          // Preserve the existing kiosk-only framing and eastward shift.
          const boostedZoom = Math.min(
            map.getZoom() + Number(DASHBOARD_CONFIG.kioskServiceAreaZoomBoost || 0),
            Number(DASHBOARD_CONFIG.kioskServiceAreaMaxZoom || 14)
          );
          const shiftedLongitude =
            fittedCenter.lng + Number(DASHBOARD_CONFIG.kioskServiceAreaCenterShiftLon || 0);

          map.setView(
            [fittedCenter.lat, shiftedLongitude],
            boostedZoom,
            { animate: false }
          );
        } else {
          // Keep the standard dashboard at the natural jurisdiction-boundary fit
          // while preventing distant apparatus from changing the framing.
          const boostedZoom = Math.min(
            map.getZoom() + Number(DASHBOARD_CONFIG.standardServiceAreaZoomBoost || 0),
            Number(DASHBOARD_CONFIG.standardServiceAreaMaxZoom || 14)
          );

          map.setView(fittedCenter, boostedZoom, { animate: false });
        }

        serviceAreaViewApplied = true;
        saveHomeMapView();
      }
    })
    .catch(error => {
      // The fixed fallback center/zoom remains active if ArcGIS is unavailable.
      console.error('Unable to load WTFD service area:', error);
    });
}

function setBaseLayer(layerName) {
  if (!map || !baseLayers[layerName]) {
    return;
  }

  Object.values(baseLayers).forEach(layer => {
    if (map.hasLayer(layer)) {
      map.removeLayer(layer);
    }
  });

  baseLayers[layerName].addTo(map);
  activeBaseLayer = layerName;

  document
    .querySelectorAll('.map-mode-button')
    .forEach(button => {
      button.classList.toggle(
        'active',
        button.dataset.layer === layerName
      );
    });
}

function updateClock() {
  const now = new Date();
  const clock = document.getElementById('clock');
  const date = document.getElementById('clockDate');

  if (clock) {
    clock.innerText = now.toLocaleTimeString([], {
      hour: 'numeric',
      minute: '2-digit',
      second: IS_KIOSK_MODE ? undefined : '2-digit'
    });
  }

  if (date) {
    date.innerText = now.toLocaleDateString([], {
      weekday: 'long',
      month: 'long',
      day: 'numeric'
    });
  }
}

function updateLastRefreshDisplay() {
  const refresh = document.getElementById('lastRefresh');
  if (!refresh) return;

  if (!lastSuccessfulDashboardRefresh) {
    refresh.innerText = 'Waiting for fleet data…';
    return;
  }

  const ageSeconds = Math.max(0, Math.floor((Date.now() - lastSuccessfulDashboardRefresh) / 1000));
  refresh.classList.toggle('refresh-warning', ageSeconds >= 60);
  refresh.classList.toggle('refresh-lost', ageSeconds >= 300);

  let ageText;
  if (ageSeconds < 5) ageText = 'Just now';
  else if (ageSeconds < 60) ageText = `${ageSeconds} seconds ago`;
  else {
    const minutes = Math.floor(ageSeconds / 60);
    ageText = `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  }

  refresh.innerHTML = `<span>Last Update</span><strong>${ageText}</strong>`;
}

function automaticLayerForTime() {
  return 'street';
}

function applyAutomaticMapTheme() {
  if (!map || activeBaseLayer === 'satellite') return;
  const desired = automaticLayerForTime();
  if (preferredAutomaticLayer !== desired || activeBaseLayer !== desired) {
    preferredAutomaticLayer = desired;
    setBaseLayer(desired);
  }
}

setInterval(updateClock, 1000);
setInterval(updateLastRefreshDisplay, 1000);
setInterval(applyAutomaticMapTheme, 60000);
updateClock();

function ageMinutes(time) {
  if (!time) {
    return 999999;
  }

  const parsed = new Date(time);

  if (Number.isNaN(parsed.getTime())) {
    return 999999;
  }

  return (
    new Date() - parsed
  ) / 60000;
}

function hasEmergencyLights(v) {
  if (!v) {
    return false;
  }

  const value = v.emergencyLights;

  if (value === true || value === 1) {
    return true;
  }

  const normalizedValue = String(
    value === null || value === undefined
      ? ''
      : value
  )
    .trim()
    .toUpperCase();

  return [
    'TRUE',
    '1',
    'YES',
    'Y',
    'ON',
    'ACTIVE'
  ].includes(normalizedValue);
}

function getStatus(v) {
  const speed = Number(v.speed || 0);

  const gpsStatus = String(
    v.gpsStatus || ''
  ).toLowerCase();

  const facility = String(
    v.facility || ''
  );

  const age = ageMinutes(v.lastUpdate);

  if (hasEmergencyLights(v)) {
    return 'responding';
  }

  if (gpsStatus === 'no gps') {
    return 'nogps';
  }

  if (gpsStatus === 'gps offline') {
    return 'offline';
  }

  if (
    age > 120 &&
    gpsStatus === 'gps'
  ) {
    return 'stale';
  }

  if (speed >= 5) {
    return 'moving';
  }

  if (
    facility &&
    facility !== 'Away' &&
    facility !== 'Unknown'
  ) {
    return 'defined';
  }

  return 'away';
}

function shouldShowMapMarker(v) {
  const unit = String(v.unit || '').trim().toLowerCase();
  const isAdministrativeCommandUnit =
    /^prevention\s*(41|42|43|44)\b/.test(unit) ||
    /^(fire\s*)?marshal\s*40\b/.test(unit) ||
    /^chief\s*(40|41|42)\b/.test(unit) ||
    /^(safety|training)\s*40\b/.test(unit);

  if (!isAdministrativeCommandUnit) return true;

  const facility = String(v.facility || '').trim().toLowerCase();
  const status = getStatus(v);
  const isAway = facility === 'away' || status === 'away';
  const isMoving = Number(v.speed || 0) >= 5;
  const isResponding = status === 'responding';

  // Preserve the existing kiosk rule: these vehicles appear on its map only
  // when operationally relevant. They remain available in kiosk rosters.
  if (IS_KIOSK_MODE) {
    return isAway || isMoving;
  }

  // On the standard map, reduce only the Headquarters cluster. Units remain
  // visible at every other facility and reappear immediately when Away,
  // moving, or responding.
  const isAtHeadquarters =
    facility.includes('headquarters') ||
    facility === 'hq';

  return (
    !isAtHeadquarters ||
    isAway ||
    isMoving ||
    isResponding
  );
}

function statusText(status, v) {
  const facility = String(
    v.facility || ''
  ).toLowerCase();

  if (status === 'responding') {
    return 'Responding';
  }

  if (status === 'nogps') {
    return 'No GPS';
  }

  if (status === 'offline') {
    return 'Offline';
  }

  if (status === 'moving') {
    return 'Moving';
  }

  if (status === 'stale') {
    const age = Math.max(0, Math.floor(ageMinutes(v.lastUpdate)));
    const days = Math.floor(age / 1440);
    const hours = Math.floor((age % 1440) / 60);
    const minutes = age % 60;

    let ageText;
    if (days > 0) {
      ageText = `${days}d${hours > 0 ? ` ${hours}h` : ''}`;
    } else if (hours > 0) {
      ageText = `${hours}h${minutes > 0 ? ` ${minutes}m` : ''}`;
    } else {
      ageText = `${minutes}m`;
    }

    return `GPS ${ageText} old`;
  }

  if (status === 'away') {
    return 'Away';
  }

  if (facility.includes('headquarters')) {
    return 'HQ';
  }

  if (facility.includes('maintenance')) {
    return 'Maintenance';
  }

  if (facility.includes('station')) {
    return 'Station';
  }

  if (
    facility.includes('hospital') ||
    facility.includes('health')
  ) {
    return 'Hospital';
  }

  return 'Located';
}

function apparatusSvg(v) {
  const type = String(v.type || '').toLowerCase();
  const identity = unitIdentityClass(v).trim();
  const name = String(v.unit || '').trim().toLowerCase();

  const common = `
    viewBox="0 0 64 64"
    aria-hidden="true"
    focusable="false"
  `;

  /*
   * Purpose-built symbols for small map and kiosk pills. The icon identifies
   * the unit family while the pill color continues to show operational state.
   */

  /* Chief 40, 41, and 42 use the same shield with two command chevrons. */
  if (identity === 'unit-chief-gold') {
    return `
      <svg ${common}>
        <path d="M32 4 L55 13 V31 C55 44 47 54 32 60 C17 54 9 44 9 31 V13 Z"
          fill="none" stroke="currentColor" stroke-width="5" stroke-linejoin="round"/>
        <path d="M18 34 L32 22 L46 34 L40 40 L32 33 L24 40 Z"
          fill="currentColor"/>
        <path d="M20 45 L32 35 L44 45 L38 50 L32 45 L26 50 Z"
          fill="currentColor"/>
      </svg>
    `;
  }

  /* Battalion 40 keeps its established shield with double command bars. */
  if (identity === 'unit-battalion-40') {
    return `
      <svg ${common}>
        <path d="M32 4 L55 13 V31 C55 44 47 54 32 60 C17 54 9 44 9 31 V13 Z"
          fill="none" stroke="currentColor" stroke-width="5" stroke-linejoin="round"/>
        <path d="M21 19 H28 V45 H21 Z M36 19 H43 V45 H36 Z"
          fill="currentColor"/>
      </svg>
    `;
  }

  /* Training and Safety share the command shield, differentiated by letter. */
  if (identity === 'unit-black-gold') {
    const letter = name.startsWith('training') ? 'T' : 'S';
    return `
      <svg ${common}>
        <path d="M32 4 L55 13 V31 C55 44 47 54 32 60 C17 54 9 44 9 31 V13 Z"
          fill="none" stroke="currentColor" stroke-width="5" stroke-linejoin="round"/>
        <text x="32" y="43" text-anchor="middle" font-size="31" font-weight="900"
          font-family="Arial, Helvetica, sans-serif" fill="currentColor">${letter}</text>
      </svg>
    `;
  }

  /* Engines use a compact fire-engine silhouette. */
  if (type === 'engine') {
    return `
      <svg ${common}>
        <path d="M4 25 H37 V18 H48 L58 29 V45 H4 Z" fill="currentColor"/>
        <rect x="8" y="14" width="31" height="6" rx="2" fill="currentColor"/>
        <rect x="12" y="9" width="5" height="8" rx="1" fill="currentColor"/>
        <rect x="20" y="9" width="5" height="8" rx="1" fill="currentColor"/>
        <rect x="28" y="9" width="5" height="8" rx="1" fill="currentColor"/>
        <path d="M43 22 H48 L54 29 H43 Z" fill="currentColor"/>
        <circle cx="16" cy="47" r="7" fill="currentColor"/>
        <circle cx="48" cy="47" r="7" fill="currentColor"/>
      </svg>
    `;
  }

  /* Ladder units use a visibly longer aerial-ladder truck silhouette. */
  if (type === 'ladder') {
    return `
      <svg ${common}>
        <path d="M3 27 H39 V20 H49 L59 30 V45 H3 Z" fill="currentColor"/>
        <path d="M7 10 H48 V16 H7 Z" fill="currentColor"/>
        <path d="M10 5 H13 V20 H10 Z M20 5 H23 V20 H20 Z M30 5 H33 V20 H30 Z M40 5 H43 V20 H40 Z"
          fill="currentColor"/>
        <path d="M44 24 H49 L55 30 H44 Z" fill="currentColor"/>
        <circle cx="15" cy="47" r="7" fill="currentColor"/>
        <circle cx="49" cy="47" r="7" fill="currentColor"/>
      </svg>
    `;
  }

  /* Medic units use a compact ambulance silhouette with a clear medical cross. */
  if (type === 'medic') {
    return `
      <svg ${common}>
        <path fill="currentColor" fill-rule="evenodd" d="
          M4 18 H39 V24 H49 L59 34 V46 H4 Z
          M18 22 H24 V28 H30 V34 H24 V40 H18 V34 H12 V28 H18 Z
        "/>
        <path d="M44 27 H49 L55 34 H44 Z" fill="currentColor"/>
        <circle cx="16" cy="48" r="7" fill="currentColor"/>
        <circle cx="49" cy="48" r="7" fill="currentColor"/>
      </svg>
    `;
  }

  /* Prevention / CRRD and Marshal use the shield with a bold check. */
  if (type === 'crrd') {
    return `
      <svg ${common}>
        <path d="M32 4 L55 13 V31 C55 44 47 54 32 60 C17 54 9 44 9 31 V13 Z"
          fill="none" stroke="currentColor" stroke-width="5" stroke-linejoin="round"/>
        <path d="M18 31 L28 41 L47 21"
          fill="none" stroke="currentColor" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    `;
  }

  /* Other command/support vehicles retain a simple SUV silhouette. */
  return `
    <svg ${common}>
      <path d="M6 38 L13 23 H40 L50 30 H57 L62 38 V48 H6 Z" fill="currentColor"/>
      <circle cx="18" cy="50" r="5" fill="currentColor"/>
      <circle cx="50" cy="50" r="5" fill="currentColor"/>
    </svg>
  `;
}

function markerShapeClass(v) {
  const type = String(
    v.type || ''
  ).toLowerCase();

  if (type === 'engine') return ' marker-engine';
  if (type === 'medic') return ' marker-medic';
  if (type === 'ladder') return ' marker-ladder';
  if (
    type === 'chief' ||
    type === 'battalion'
  ) {
    return ' marker-command';
  }

  if (type === 'crrd') return ' marker-prevention';

  return ' marker-generic';
}


function unitIdentityClass(v) {
  const name = String(v.unit || '').trim().toLowerCase();

  if (/^battalion\s*40\b/.test(name)) return ' unit-battalion-40';
  if (/^chief\s*(40|41|42)\b/.test(name)) return ' unit-chief-gold';
  if (/^(training|safety)\s*40\b/.test(name)) return ' unit-black-gold';

  return '';
}

function unitIdentityColors(v, status) {
  /* Operational exceptions remain unmistakable. */
  if (status === 'responding' || status === 'stale') {
    return { background: '#dc2626', foreground: '#ffffff', border: '#ffffff' };
  }
  if (status === 'nogps' || status === 'offline') {
    return { background: '#64748b', foreground: '#ffffff', border: '#ffffff' };
  }

  const identity = unitIdentityClass(v);
  if (identity === ' unit-battalion-40') {
    return { background: 'linear-gradient(180deg,#f2c94c 0%,#d4a900 48%,#b88900 100%)', foreground: '#000000', border: '#6f5400' };
  }
  if (identity === ' unit-chief-gold') {
    return { background: 'linear-gradient(180deg,#f2c94c 0%,#d4a900 48%,#b88900 100%)', foreground: '#ffffff', border: '#ffffff' };
  }
  if (identity === ' unit-black-gold') {
    return { background: '#050505', foreground: '#d4a900', border: '#d4a900' };
  }

  return null;
}

function markerColor(v, status) {
  /*
   * Critical operational statuses override apparatus type.
   */
  if (status === 'responding') {
    return '#dc2626';
  }

  if (status === 'stale') {
    return '#dc2626';
  }

  if (status === 'nogps') {
    return '#64748b';
  }

  if (status === 'offline') {
    return '#6b7280';
  }

  const identityColors = unitIdentityColors(v, status);
  if (identityColors) return identityColors.background;

  const type = String(
    v.type || ''
  ).toLowerCase();

  const unitName = String(
    v.unit || ''
  ).toLowerCase();

  /*
   * Safety units use amber even though they may currently be
   * configured as Battalion in UnitConfig.
   */
  if (unitName.includes('safety')) {
    return '#ca8a04';
  }

  if (type === 'engine') {
    return '#d32f2f';
  }

  if (type === 'medic') {
    return '#2563eb';
  }

  if (type === 'ladder') {
    return '#991b1b';
  }

  if (type === 'battalion') {
    return '#6d28d9';
  }

  if (type === 'chief') {
    return '#4c1d95';
  }

  if (type === 'crrd') {
    return '#15803d';
  }

  return '#475569';
}

function shortLabel(v) {
  const unit = String(v.unit || '').trim();
  const match = unit.match(/\d+/);
  const number = match ? match[0] : '';
  const normalizedUnit = unit.toLowerCase();

  /*
   * The map pill must follow the configured unit name, not the apparatus
   * type. A command vehicle can be typed as Chief/Battalion for styling,
   * but "Battalion 40" must still render B40 and "Chief 40" must render C40.
   */
  if (/^medic\b/.test(normalizedUnit)) return 'M' + number;
  if (/^engine\b/.test(normalizedUnit)) return 'E' + number;
  if (/^(ladder|truck)\b/.test(normalizedUnit)) return 'L' + number;
  if (/^battalion\b/.test(normalizedUnit)) return 'B' + number;
  if (/^chief\b/.test(normalizedUnit)) return 'C' + number;
  if (/^training\b/.test(normalizedUnit)) return 'T' + number;
  if (/^safety\b/.test(normalizedUnit)) return 'S' + number;
  if (/^prevention\b/.test(normalizedUnit)) return 'P' + number;
  if (/^(fire\s*)?marshal\b/.test(normalizedUnit)) return 'FM' + number;

  // Fall back to type only when the configured unit name has no known prefix.
  const type = String(v.type || '').toLowerCase();
  if (number) {
    if (type === 'medic') return 'M' + number;
    if (type === 'engine') return 'E' + number;
    if (type === 'ladder') return 'L' + number;
    if (type === 'battalion') return 'B' + number;
    if (type === 'chief') return 'C' + number;
    if (type === 'crrd') return 'P' + number;
  }

  return unit.substring(0, 5);
}

function markerIcon(v, status, pixelOffset = [0, 0]) {
  let statusClass = '';

  if (status === 'responding') {
    statusClass = ' respondingMarker';
  } else if (status === 'moving') {
    statusClass = ' movingMarker';
  } else if (status === 'away') {
    statusClass = ' awayMarker';
  } else if (status === 'stale') {
    statusClass = ' staleMarker';
  }

  const shapeClass = markerShapeClass(v);
  const identityClass = unitIdentityClass(v);
  const identityColors = unitIdentityColors(v, status);
  const width = IS_KIOSK_MODE ? 86 : 90;
  const height = IS_KIOSK_MODE ? 36 : 38;
  const dx = Number(pixelOffset[0] || 0);
  const dy = Number(pixelOffset[1] || 0);
  const connectorLength = Math.sqrt(dx * dx + dy * dy);
  const connectorAngle = Math.atan2(-dy, -dx) * 180 / Math.PI;
  const displacedClass = connectorLength > 1 ? ' marker-displaced' : '';

  return L.divIcon({
    className: '',
    html: `
      <div
        class="marker-shell${displacedClass}"
        style="--marker-dx:${dx}px;--marker-dy:${dy}px;--connector-length:${connectorLength}px;--connector-angle:${connectorAngle}deg"
      >
        <span class="marker-connector" aria-hidden="true"></span>
        <div
          class="marker-tag${shapeClass}${identityClass}${statusClass}"
          style="background:${markerColor(v, status)};color:${identityColors?.foreground || '#ffffff'};border-color:${identityColors?.border || '#ffffff'}"
        >
          <span class="marker-svg">
            ${apparatusSvg(v)}
          </span>
          <span class="marker-label">${shortLabel(v)}</span>
        </div>
      </div>
    `,
    iconSize: [width, height],
    // Only the rendered label is offset. The Leaflet marker and popup remain
    // attached to the apparatus's true GPS coordinate.
    iconAnchor: [
      width / 2 - dx,
      height / 2 - dy
    ]
  });
}

function markerZIndex(v, status) {
  const type = String(
    v.type || ''
  ).toLowerCase();

  if (status === 'responding') return 20000;
  if (status === 'moving') return 10000;
  if (type === 'chief') return 9000;
  if (type === 'battalion') return 8500;
  if (type === 'engine') return 8000;
  if (type === 'medic') return 7600;
  if (type === 'ladder') return 7400;
  if (type === 'crrd') return 7200;
  if (status === 'stale') return 7000;

  return 6500;
}

function timeAgo(time) {
  if (!time) {
    return 'No GPS';
  }

  const parsed = new Date(time);

  if (Number.isNaN(parsed.getTime())) {
    return 'Unknown';
  }

  const seconds = Math.max(
    0,
    Math.round(
      (new Date() - parsed) / 1000
    )
  );

  if (seconds < 30) return 'Just now';
  if (seconds < 60) return seconds + ' sec ago';

  const minutes = Math.round(
    seconds / 60
  );

  if (minutes === 1) return '1 min ago';
  if (minutes < 60) return minutes + ' min ago';

  const hours = Math.round(
    minutes / 60
  );

  if (hours === 1) return '1 hr ago';

  return hours + ' hr ago';
}

/*
 * Group only apparatus whose true GPS points are essentially on top of one
 * another. This avoids the old wide fan-out that separated nearby apparatus
 * even when they were on different roads or different parts of a station.
 */
function buildMarkerCollisionGroups(locations) {
  const pending = locations.map((vehicle, originalIndex) => ({
    vehicle,
    originalIndex,
    point: map.latLngToContainerPoint([
      Number(vehicle.lat),
      Number(vehicle.lon)
    ])
  }));

  const groups = [];
  const visited = new Set();
  const thresholdX = IS_KIOSK_MODE ? 22 : 16;
  const thresholdY = IS_KIOSK_MODE ? 18 : 14;

  pending.forEach((item, itemIndex) => {
    if (visited.has(itemIndex)) return;

    const groupIndexes = [];
    const queue = [itemIndex];
    visited.add(itemIndex);

    while (queue.length) {
      const currentIndex = queue.shift();
      const current = pending[currentIndex];
      groupIndexes.push(currentIndex);

      pending.forEach((candidate, candidateIndex) => {
        if (visited.has(candidateIndex)) return;

        const horizontalGap = Math.abs(current.point.x - candidate.point.x);
        const verticalGap = Math.abs(current.point.y - candidate.point.y);

        if (horizontalGap <= thresholdX && verticalGap <= thresholdY) {
          visited.add(candidateIndex);
          queue.push(candidateIndex);
        }
      });
    }

    groups.push(groupIndexes.map(index => pending[index].vehicle));
  });

  return groups;
}

function markerLayoutOffsets(total) {
  if (total <= 1) return [[0, 0]];

  // Compact fan-out patterns keep every label visible without making an
  // apparatus appear to be on a different road or outside the jurisdiction.
  // The true Leaflet marker and popup remain anchored to the GPS coordinate;
  // only the label is displaced and connected back to that point.
  const x = IS_KIOSK_MODE ? 43 : 46;
  const y = IS_KIOSK_MODE ? 34 : 36;

  const patterns = {
    2: [[-x, 0], [x, 0]],
    3: [[0, -y], [-x, y * 0.7], [x, y * 0.7]],
    4: [[-x, -y], [x, -y], [-x, y], [x, y]],
    5: [[0, -y * 1.25], [-x, -y * 0.25], [x, -y * 0.25], [-x, y], [x, y]],
    6: [[-x, -y], [x, -y], [-x, 0], [x, 0], [-x, y], [x, y]]
  };

  if (patterns[total]) return patterns[total];

  // Seven or more labels use a compact three-column grid. This is uncommon,
  // but prevents any label from being completely hidden in a dense station.
  const columns = 3;
  const rows = Math.ceil(total / columns);
  const offsets = [];

  for (let index = 0; index < total; index++) {
    const column = index % columns;
    const row = Math.floor(index / columns);
    offsets.push([
      (column - 1) * x,
      (row - (rows - 1) / 2) * y
    ]);
  }

  return offsets;
}

function statusPriority(status) {
  const priority = {
    responding: 1,
    moving: 2,
    away: 3,
    stale: 4,
    defined: 5,
    offline: 6,
    nogps: 7
  };

  return priority[status] || 99;
}

function sortGroupForLayout(group) {
  const typePriority = {
    chief: 1,
    battalion: 2,
    engine: 3,
    medic: 4,
    ladder: 5,
    crrd: 6
  };

  return group.slice().sort((a, b) => {
    const sA = statusPriority(getStatus(a));
    const sB = statusPriority(getStatus(b));

    if (sA !== sB) return sA - sB;

    const tA = typePriority[
      String(a.type || '').toLowerCase()
    ] || 99;
    const tB = typePriority[
      String(b.type || '').toLowerCase()
    ] || 99;

    if (tA !== tB) return tA - tB;

    return String(a.unit || '').localeCompare(
      String(b.unit || '')
    );
  });
}

function clearMarkers() {
  Object.values(markers).forEach(
    marker => map.removeLayer(marker)
  );

  markers = {};
}

function setText(id, value) {
  const el = document.getElementById(id);

  if (el) {
    el.innerText = value;
  }
}

function extractFNumber(
  rawName,
  apparatusNumber
) {
  if (apparatusNumber) {
    return String(
      apparatusNumber
    ).toUpperCase();
  }

  const match = String(
    rawName || ''
  ).match(/F\d+/i);

  return match
    ? match[0].toUpperCase()
    : '';
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function latestFleetHealthStat(stat) {
  if (!stat) return null;
  if (!Array.isArray(stat)) return stat;
  return stat.reduce((newest, item) => (
    !newest || new Date(item?.time || 0) > new Date(newest?.time || 0)
      ? item
      : newest
  ), null);
}

function fleetHealthValue(stat) {
  const latest = latestFleetHealthStat(stat);
  return latest && typeof latest === 'object' && 'value' in latest
    ? latest.value
    : null;
}

function fleetHealthFaultCount(vehicle) {
  const fault = latestFleetHealthStat(vehicle?.stats?.faultCodes);
  if (!fault) return 0;
  const obd = fault.obdii || fault.value?.obdii || {};
  const j1939 = fault.j1939 || fault.value?.j1939 || {};
  const codes = [];
  if (obd.checkEngineLightIsOn) codes.push('check-engine');
  (obd.diagnosticTroubleCodes || []).forEach(group => {
    ['confirmedDtcs', 'pendingDtcs', 'permanentDtcs'].forEach(key => {
      (group[key] || []).forEach(code => codes.push(
        typeof code === 'string' ? code : (code.dtcShortCode || code.code || key)
      ));
    });
  });
  (j1939.diagnosticTroubleCodes || []).forEach(code => codes.push(
    `${code.spnId ?? ''}-${code.fmiId ?? ''}-${code.txId ?? ''}`
  ));
  return new Set(codes).size;
}

function fleetHealthTelemetryTime(vehicle) {
  return Object.values(vehicle?.stats || {})
    .map(stat => latestFleetHealthStat(stat)?.time)
    .filter(Boolean)
    .sort()
    .at(-1) || null;
}

function fleetHealthSummary(vehicle) {
  if (!vehicle) return null;
  const fuel = fleetHealthValue(vehicle.stats?.fuelPercents);
  const batteryMv = fleetHealthValue(vehicle.stats?.batteryMilliVolts);
  const battery = batteryMv == null ? null : Number(batteryMv) / 1000;
  const engine = String(fleetHealthValue(vehicle.stats?.engineStates) || 'Unknown');
  const faults = fleetHealthFaultCount(vehicle);
  let label = 'Normal';
  let tone = 'good';
  if (faults > 0) {
    label = 'Active Fault';
    tone = 'bad';
  } else if (fuel != null && Number(fuel) < 60) {
    label = 'Low Fuel';
    tone = 'warn';
  } else if (battery != null && engine.toLowerCase() === 'off' && battery < 12) {
    label = 'Low Battery';
    tone = 'warn';
  }
  return { fuel, battery, faults, label, tone, updated: fleetHealthTelemetryTime(vehicle) };
}

function fleetHealthLink(apparatusNumber = '') {
  const base = DASHBOARD_CONFIG.fleetHealthDashboardUrl;
  return apparatusNumber
    ? `${base}?vehicle=${encodeURIComponent(apparatusNumber)}`
    : base;
}

function fleetHealthPopupHtml(location) {
  if (IS_KIOSK_MODE) return '';
  const apparatusNumber = extractFNumber(location.rawName, location.apparatusNumber);
  const health = fleetHealthSummary(fleetHealthByApparatus.get(apparatusNumber));
  const link = fleetHealthLink(apparatusNumber);
  if (!health) {
    return `<div class="popup-health"><strong>Fleet Health:</strong> Loading…<br><a href="${escapeHtml(link)}" target="_blank" rel="noopener noreferrer">View Full Diagnostics</a></div>`;
  }
  return `<div class="popup-health">
    <strong>Fleet Health:</strong> <span class="popup-health-status ${health.tone}">${escapeHtml(health.label)}</span><br>
    <strong>Fuel:</strong> ${health.fuel == null ? 'Not reported' : `${Math.round(Number(health.fuel))}%`}<br>
    <strong>Battery:</strong> ${health.battery == null ? 'Not reported' : `${health.battery.toFixed(1)} V`}<br>
    <strong>Active Faults:</strong> ${health.faults}<br>
    <strong>Health Updated:</strong> ${escapeHtml(timeAgo(health.updated))}<br>
    <a href="${escapeHtml(link)}" target="_blank" rel="noopener noreferrer">View Full Diagnostics</a>
  </div>`;
}

async function loadFleetHealth() {
  if (IS_KIOSK_MODE || fleetHealthRequestInFlight) return;
  fleetHealthRequestInFlight = true;
  try {
    const response = await fetch(`${DASHBOARD_CONFIG.fleetHealthApiUrl}?t=${Date.now()}`, { cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    const next = new Map();
    (data.vehicles || []).forEach(vehicle => {
      const apparatusNumber = extractFNumber(vehicle.name, '');
      if (apparatusNumber) next.set(apparatusNumber, vehicle);
    });
    fleetHealthByApparatus = next;
    if (allLocations.length) renderDashboard(allLocations);
  } catch (error) {
    console.warn('Unable to load Fleet Health data:', error);
  } finally {
    fleetHealthRequestInFlight = false;
  }
}

function buildFleetMetrics(locations) {
  const metrics = {
    engines: 0,
    medics: 0,
    command: 0,
    prevention: 0,
    responding: 0,
    available: 0,
    away: 0,
    gpsIssues: 0
  };

  locations.forEach(v => {
    const type = String(
      v.type || ''
    ).toLowerCase();

    const status = getStatus(v);

    if (type === 'engine') {
      metrics.engines++;
    }

    if (type === 'medic') {
      metrics.medics++;
    }

    if (
      type === 'chief' ||
      type === 'battalion'
    ) {
      metrics.command++;
    }

    if (type === 'crrd') {
      metrics.prevention++;
    }

    if (status === 'responding') {
      metrics.responding++;
    }

    if (status === 'defined') {
      metrics.available++;
    }

    if (status === 'away') {
      metrics.away++;
    }

    if (
      status === 'nogps' ||
      status === 'offline' ||
      status === 'stale'
    ) {
      metrics.gpsIssues++;
    }
  });

  return metrics;
}

function renderCommandPanel(metrics) {
  setText(
    'commandResponding',
    metrics.responding
  );

  setText(
    'commandEngines',
    metrics.engines
  );

  setText(
    'commandMedics',
    metrics.medics
  );

  setText(
    'commandCommand',
    metrics.command
  );

  setText(
    'commandPrevention',
    metrics.prevention
  );

  setText(
    'commandAvailable',
    metrics.available
  );

  setText(
    'commandAway',
    metrics.away
  );

  setText(
    'commandGpsIssues',
    metrics.gpsIssues
  );

  const panel = document.getElementById(
    'commandStatusPanel'
  );

  if (panel) {
    panel.classList.toggle(
      'has-response',
      metrics.responding > 0
    );
  }
}

function renderDashboard(locations) {
  const nextMarkers = {};
  const markerBuildErrors = [];

  const unitList =
    document.getElementById(
      'apparatusList'
    );

  unitList.innerHTML = '';

  const searchInput =
    document.getElementById(
      'search'
    );

  const searchText = String(
    searchInput
      ? searchInput.value
      : ''
  ).toLowerCase();

  const filtered = locations
    .filter(v => {
      const haystack = [
        v.unit,
        v.rawName,
        v.type,
        v.homeStation,
        v.facility,
        v.location,
        v.apparatusNumber
      ]
        .join(' ')
        .toLowerCase();

      return haystack.includes(
        searchText
      );
    })
    .sort((a, b) => {
      const statusDifference =
        statusPriority(
          getStatus(a)
        ) -
        statusPriority(
          getStatus(b)
        );

      if (statusDifference !== 0) {
        return statusDifference;
      }

      return String(
        a.unit || ''
      ).localeCompare(
        String(b.unit || '')
      );
    });

  const markerLocations = filtered.filter(shouldShowMapMarker);
  const collisionGroups =
    buildMarkerCollisionGroups(markerLocations);
  const metrics = buildFleetMetrics(
    locations
  );

  let gps = 0;
  let noGps = 0;
  let stale = 0;

  locations.forEach(v => {
    const gpsStatus = String(v.gpsStatus || '').toLowerCase();
    if (gpsStatus === 'gps') gps++;
    if (gpsStatus === 'no gps') noGps++;
    if (getStatus(v) === 'stale') stale++;
  });

  collisionGroups.forEach(originalGroup => {
    const layoutGroup = sortGroupForLayout(
      originalGroup
    );
    const offsets = markerLayoutOffsets(
      layoutGroup.length
    );

    layoutGroup.forEach((v, index) => {
      const status = getStatus(v);
      const pixelOffset = offsets[index] || [0, 0];

      try {
        const marker = L.marker(
          [Number(v.lat), Number(v.lon)],
          {
            icon: markerIcon(
              v,
              status,
              pixelOffset
            ),
            zIndexOffset:
              markerZIndex(v, status)
          }
        ).addTo(map);

        const emergencyText =
          hasEmergencyLights(v)
            ? '<span class="popup-alert">ACTIVE</span>'
            : 'Off';

        marker.bindPopup(`
          <div class="popup-title">
            <span class="popup-svg">
              ${apparatusSvg(v)}
            </span>
            <strong>${escapeHtml(v.unit)}</strong>
          </div>
          <br>
          <strong>Status:</strong> ${escapeHtml(statusText(status, v))}<br>
          <strong>Emergency Lights:</strong> ${emergencyText}<br>
          <strong>Facility:</strong> ${escapeHtml(v.facility || 'Away')}<br>
          <strong>Location:</strong> ${escapeHtml(v.location || 'Unknown')}<br>
          <strong>Home Station:</strong> ${escapeHtml(v.homeStation || '')}<br>
          <strong>Speed:</strong> ${Number(v.speed || 0).toFixed(1)} mph<br>
          <strong>Updated:</strong> ${escapeHtml(timeAgo(v.lastUpdate))}<br><br>
          ${fleetHealthPopupHtml(v)}
          ${
            v.mapLink
              ? `<a href="${escapeHtml(v.mapLink)}" target="_blank" rel="noopener noreferrer">Open in Google Maps</a>`
              : ''
          }
        `);

        nextMarkers[
          v.rawName + '-' + v.unit
        ] = marker;
      } catch (error) {
        markerBuildErrors.push({
          unit: v.unit || v.rawName || 'Unknown unit',
          error
        });
        console.error(
          'Unable to render vehicle marker:',
          v,
          error
        );
      }
    });
  });

  // Replace the live marker set only after the new set has been built.
  // If every marker fails, preserve the last known-good markers instead
  // of leaving the map empty.
  if (Object.keys(nextMarkers).length > 0 || locations.length === 0) {
    Object.values(markers).forEach(marker => {
      if (map.hasLayer(marker)) map.removeLayer(marker);
    });
    markers = nextMarkers;
  } else {
    Object.values(nextMarkers).forEach(marker => {
      if (map.hasLayer(marker)) map.removeLayer(marker);
    });
    console.error('Marker refresh aborted; preserving previous markers.', markerBuildErrors);
  }

  filtered.forEach(v => {
    const status = getStatus(v);

    const div =
      document.createElement('div');

    div.className =
      `unit ${status}`;

    const fNumber =
      extractFNumber(
        v.rawName,
        v.apparatusNumber
      );

    div.innerHTML = `
      <div class="unit-icon" aria-hidden="true">
        ${apparatusSvg(v)}
      </div>

      <div class="unit-main">
        <div class="unit-title">
          ${escapeHtml(
            String(
              v.unit || ''
            ).toUpperCase()
          )}
        </div>

        <div class="unit-sub">
          ${escapeHtml(
            status === 'away'
              ? conciseAwayLocation(v)
              : (v.facility || v.homeStation || 'Unknown')
          )}
          ${
            fNumber
              ? ' • ' +
                escapeHtml(
                  fNumber
                )
              : ''
          }
        </div>
      </div>

      <span class="badge ${status}">
        ${escapeHtml(
          statusText(
            status,
            v
          )
        )}
      </span>
    `;

    div.onclick = () => {
      const marker =
        markers[
          v.rawName +
          '-' +
          v.unit
        ];

      if (marker) {
        map.setView(
          marker.getLatLng(),
          17
        );

        marker.openPopup();
      }
    };

    unitList.appendChild(div);
  });

  setText(
    'apparatusCount',
    locations.length
  );

  setText(
    'respondingCount',
    metrics.responding
  );

  setText(
    'availableCount',
    metrics.available
  );

  setText(
    'awayCount',
    metrics.away
  );

  setText(
    'gpsIssueCount',
    metrics.gpsIssues
  );

  setText(
    'gpsCount',
    gps
  );

  setText(
    'noGpsCount',
    noGps
  );

  setText(
    'staleCount',
    stale
  );

  renderCommandPanel(metrics);

  renderKioskStatusBoard(locations, metrics, gps, noGps, stale);

  const respondingCard =
    document.querySelector(
      '.respondingCard'
    );

  if (respondingCard) {
    respondingCard.classList.toggle(
      'active-response',
      metrics.responding > 0
    );
  }

  const refresh =
    document.getElementById(
      'lastRefresh'
    );

  updateLastRefreshDisplay();

  /*
   * Keep the map at its configured response-area center and zoom.
   * Distant apparatus remain available in the apparatus list but
   * will not force the map to zoom out.
   */
}


function kioskUnitTypeClass(v) {
  const identity = unitIdentityClass(v).trim();
  if (identity) return identity;

  const type = String(v.type || '').toLowerCase();
  if (type === 'engine' || type === 'ladder') return 'fire';
  if (type === 'medic') return 'medic';
  if (type === 'chief' || type === 'battalion') return 'command';
  if (type === 'crrd') return 'prevention';
  return 'other';
}


function normalizeAwayMunicipality(value) {
  const cleaned = String(value || '')
    .replace(/^City of\s+/i, '')
    .replace(/^Village of\s+/i, '')
    .trim();

  if (/^Washington Township$/i.test(cleaned)) return 'Washington Twp';
  return cleaned;
}

function conciseAwayLocation(v) {
  const raw = String(v.location || v.facility || 'Away').trim();
  if (!raw) return 'Away';

  /*
   * Samsara normally returns a comma-delimited reverse-geocoded location,
   * such as "Paragon Road, Washington Township, OH, 45458". Remove the
   * state, country, and postal-code components, then use the final remaining
   * component as the municipality. The street is retained as the fallback.
   */
  const parts = raw
    .split(',')
    .map(part => part.trim())
    .filter(Boolean);

  const isPostalCode = part => /^\d{5}(?:-\d{4})?$/.test(part);
  const isState = part => /^(OH|Ohio)(?:\s+\d{5}(?:-\d{4})?)?$/i.test(part);
  const isCountry = part => /^(USA|US|United States(?: of America)?)$/i.test(part);

  const candidates = parts
    .map(part => part.replace(/\b(?:OH|Ohio)\s+\d{5}(?:-\d{4})?$/i, '').trim())
    .filter(part => part && !isPostalCode(part) && !isState(part) && !isCountry(part));

  if (candidates.length >= 2) {
    return normalizeAwayMunicipality(candidates[candidates.length - 1]);
  }

  if (candidates.length === 1) {
    const fallback = normalizeAwayMunicipality(candidates[0]);
    return fallback.length > 34 ? `${fallback.slice(0, 31)}…` : fallback;
  }

  return 'Away';
}

function renderKioskStatusBoard(locations, metrics, gps, noGps, stale) {
  if (!IS_KIOSK_MODE) return;

  const responding = locations
    .filter(v => getStatus(v) === 'responding')
    .sort((a, b) => String(a.unit || '').localeCompare(String(b.unit || '')));

  currentRespondingUnits = responding.map(v => v.unit || v.displayName || 'Responding unit');
  updateKioskOperationStrip();

  /*
   * The kiosk away roster should follow the live Facility assignment, not
   * only the visual movement status. A unit can be moving, stale, or have a
   * GPS warning while its Facility is still "Away". Keep active responders
   * in the responding section, but include every other unit assigned Away.
   */
  const away = locations
    .filter(v => {
      const status = getStatus(v);
      const facility = String(v.facility || '').trim().toLowerCase();
      return status !== 'responding' && (facility === 'away' || status === 'away');
    })
    .sort((a, b) => String(a.unit || '').localeCompare(String(b.unit || '')));

  const respondingList = document.getElementById('kioskRespondingList');
  if (respondingList) {
    respondingList.innerHTML = responding.length
      ? responding.map(v => `
          <div class="kiosk-unit-row responding">
            <span>${escapeHtml(String(v.unit || '').toUpperCase())}</span>
            <strong>${escapeHtml(v.location || 'Responding')}</strong>
          </div>`).join('')
      : '<div class="kiosk-empty-state">No Active Incidents</div>';
  }

  const normalizeStationKey = value => {
    const text = String(value || '').trim();
    if (!text) return '';
    if (/^(?:hq|headquarters)$/i.test(text)) return 'headquarters';
    const stationNumber = text.match(/(?:station\s*)?(\d+)/i)?.[1];
    return stationNumber ? `station ${stationNumber}` : text.toLowerCase();
  };

  /*
   * Build kiosk station rows from both configured home stations and current
   * recognized facilities. This keeps a unit visible at its live facility
   * even when that facility differs from its configured home station.
   */
  const stationDisplayNames = new Map();
  locations.forEach(v => {
    [v.homeStation, v.facility].forEach(value => {
      const key = normalizeStationKey(value);
      if (!key || /^(?:away|unknown)$/i.test(String(value || '').trim())) return;
      if (!stationDisplayNames.has(key)) {
        stationDisplayNames.set(key, key === 'headquarters' ? 'Headquarters' : String(value || '').trim());
      }
    });
  });

  const stationNames = [...stationDisplayNames.entries()]
    .sort((a, b) => a[1].localeCompare(b[1], undefined, { numeric: true }));

  const stationList = document.getElementById('kioskStationList');
  if (stationList) {
    stationList.innerHTML = stationNames.map(([stationKey, station]) => {
      const present = locations.filter(v => {
        const facilityKey = normalizeStationKey(v.facility);
        return facilityKey && facilityKey === stationKey;
      });
      const stationNumber = station.match(/\d+/)?.[0] || station.replace(/^Station\s*/i, '') || station;
      const stationLabel = /headquarters/i.test(station) ? 'HQ' : stationNumber;
      const stateClass = present.length ? 'covered' : 'empty';
      const detail = present.length
        ? `<div class="kiosk-station-units">${present.map(v =>
            `<span class="${kioskUnitTypeClass(v)}">${escapeHtml(shortLabel(v))}</span>`
          ).join('')}</div>`
        : '<div class="kiosk-station-empty" aria-label="No units at station">—</div>';
      return `
        <div class="kiosk-station-card ${stateClass}">
          <div class="kiosk-station-name">${escapeHtml(stationLabel)}<small>${present.length}</small></div>
          <div class="kiosk-station-detail">${detail}</div>
        </div>`;
    }).join('');
  }

  const awayList = document.getElementById('kioskAwayList');
  if (awayList) {
    awayList.innerHTML = away.length
      ? away.map(v => `
          <div class="kiosk-unit-row away">
            <span>${escapeHtml(String(v.unit || '').toUpperCase())}</span>
            <strong title="${escapeHtml(v.location || v.facility || 'Away')}">${escapeHtml(conciseAwayLocation(v))}</strong>
          </div>`).join('')
      : '<div class="kiosk-empty-state">No Units Away</div>';
  }

  const health = document.getElementById('kioskHealth');
  if (health) {
    health.innerHTML = `
      <div><span>GPS Good</span><strong class="good">${gps}</strong></div>
      <div><span>No GPS</span><strong>${noGps}</strong></div>
      <div><span>Stale</span><strong class="bad">${stale}</strong></div>
      <div><span>Available</span><strong class="good">${metrics.available}</strong></div>`;
  }
}

function forceSync() {
  const refresh =
    document.getElementById(
      'lastRefresh'
    );

  if (refresh) {
    refresh.innerText =
      'Syncing...';
  }

  const forceButton =
    document.getElementById(
      'forceSync'
    );

  if (forceButton) {
    forceButton.disabled = true;
  }

  apiRequest('sync')
    .then(() => loadDashboard())
    .catch(error => {
      if (refresh) {
        refresh.innerText =
          'Sync error: ' +
          error.message;
      }
    })
    .finally(() => {
      if (forceButton) {
        forceButton.disabled = false;
      }
    });
}

function saveDashboardCache(data) {
  try {
    localStorage.setItem(DASHBOARD_CONFIG.cacheKey, JSON.stringify({
      savedAt: Date.now(),
      data
    }));
  } catch (error) {
    console.warn('Unable to cache dashboard data:', error);
  }
}

function readDashboardCache() {
  try {
    const cached = JSON.parse(localStorage.getItem(DASHBOARD_CONFIG.cacheKey) || 'null');
    return cached && cached.data ? cached : null;
  } catch (error) {
    console.warn('Unable to read dashboard cache:', error);
    return null;
  }
}

function updateReconnectCountdown() {
  const detailElement = document.getElementById('reconnectDetail');
  const countdownElement = document.getElementById('reconnectCountdown');
  if (!detailElement || !countdownElement || !nextReconnectAttemptAt) return;
  const seconds = Math.max(0, Math.ceil((nextReconnectAttemptAt - Date.now()) / 1000));
  countdownElement.textContent = `Retrying in ${seconds} second${seconds === 1 ? '' : 's'}…`;
}

function setReconnectOverlay(visible, detail = '') {
  const overlay = document.getElementById('reconnectOverlay');
  const detailElement = document.getElementById('reconnectDetail');
  if (!overlay) return;
  overlay.hidden = !visible;
  if (detailElement) detailElement.textContent = detail;
  if (!visible) {
    nextReconnectAttemptAt = 0;
    clearInterval(reconnectCountdownTimer);
    reconnectCountdownTimer = null;
  } else if (!reconnectCountdownTimer) {
    updateReconnectCountdown();
    reconnectCountdownTimer = setInterval(updateReconnectCountdown, 250);
  }
}

function scheduleReconnect() {
  if (reconnectRetryTimer) return;
  nextReconnectAttemptAt = Date.now() + DASHBOARD_CONFIG.reconnectRetryMs;
  updateReconnectCountdown();
  reconnectRetryTimer = setTimeout(() => {
    reconnectRetryTimer = null;
    loadDashboard();
  }, DASHBOARD_CONFIG.reconnectRetryMs);
}

async function loadDashboard() {
  if (dashboardRequestInFlight) return;
  dashboardRequestInFlight = true;

  try {
    const data = await apiRequest('dashboard');
    const settings = data.settings || {};
    lastDashboardSettings = settings;
    allLocations = data.locations || [];

    if (!map) initMap(settings);
    renderDashboard(allLocations);
    saveDashboardCache(data);
    recordSuccessfulDashboardRefresh();
    setReconnectOverlay(false);

    if (reconnectRetryTimer) {
      clearTimeout(reconnectRetryTimer);
      reconnectRetryTimer = null;
    }
  } catch (error) {
    consecutiveDashboardFailures++;
    const cached = readDashboardCache();

    if ((!allLocations || !allLocations.length) && cached) {
      const data = cached.data;
      lastDashboardSettings = data.settings || {};
      allLocations = data.locations || [];
      if (!map) initMap(lastDashboardSettings);
      renderDashboard(allLocations);
    }

    const age = lastSuccessfulDashboardRefresh
      ? Date.now() - lastSuccessfulDashboardRefresh
      : DASHBOARD_CONFIG.connectionLostMs;
    const state = age >= DASHBOARD_CONFIG.connectionLostMs ? 'lost' : 'delayed';
    setConnectionState(state, state === 'lost' ? '● OFFLINE' : '● DELAYED');
    setReconnectOverlay(true, cached
      ? 'Showing the last successful fleet data while reconnecting.'
      : 'No fleet data is available yet. Retrying automatically.');
    console.warn('Dashboard refresh failed:', error);

    if (IS_KIOSK_MODE && consecutiveDashboardFailures >= DASHBOARD_CONFIG.kioskReloadAfterFailures) {
      window.location.reload();
      return;
    }

    scheduleReconnect();
  } finally {
    dashboardRequestInFlight = false;
  }
}

const searchInput =
  document.getElementById(
    'search'
  );

if (searchInput) {
  searchInput.addEventListener(
    'input',
    () => {
      renderDashboard(
        allLocations
      );
    }
  );
}

const forceButton =
  document.getElementById(
    'forceSync'
  );

if (forceButton) {
  forceButton.addEventListener(
    'click',
    forceSync
  );
}

document
  .querySelectorAll(
    '.map-mode-button'
  )
  .forEach(button => {
    button.addEventListener(
      'click',
      () => {
        setBaseLayer(
          button.dataset.layer
        );
      }
    );
  });

loadDashboard();
loadFleetHealth();
setInterval(
  loadDashboard,
  DASHBOARD_CONFIG.dashboardRefreshMs
);
setInterval(loadFleetHealth, DASHBOARD_CONFIG.fleetHealthRefreshMs);

function normalizeIncidentCoordinate(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function incidentKey(alert) {
  if (alert && alert.id) return String(alert.id);
  return [alert?.address, alert?.unit, alert?.city]
    .filter(Boolean)
    .join('|')
    .trim()
    .toLowerCase();
}

function respondingUnitSummary() {
  return currentRespondingUnits
    .map(unit => String(unit || '').trim().toUpperCase())
    .filter(Boolean)
    .join(' • ');
}

function updateKioskOperationStrip(alert = activeIncidentAlert) {
  if (!IS_KIOSK_MODE) return;
  const strip = document.getElementById('kioskOperationStrip');
  const state = document.getElementById('kioskOperationState');
  const summary = document.getElementById('kioskIncidentSummary');
  if (!strip || !state || !summary) return;

  if (alert) {
    strip.hidden = false;
    strip.classList.add('incident');
    state.textContent = 'ACTIVE INCIDENT';
    const address = [alert.address, alert.unit].filter(Boolean).join(' ');
    summary.textContent = [alert.description || 'Emergency Call', address]
      .filter(Boolean)
      .join(' • ');
    return;
  }

  if (currentRespondingUnits.length > 0) {
    strip.hidden = false;
    strip.classList.add('incident');
    state.textContent = currentRespondingUnits.length === 1
      ? 'UNIT RESPONDING'
      : 'UNITS RESPONDING';
    summary.textContent = respondingUnitSummary();
    return;
  }

  strip.classList.remove('incident');
  strip.hidden = true;
  state.textContent = '';
  summary.textContent = '';
}

function clearTemporaryIncidentMarker() {
  if (activeIncidentMarkerTimer) {
    clearTimeout(activeIncidentMarkerTimer);
    activeIncidentMarkerTimer = null;
  }
  if (activeIncidentMarker && map) {
    map.removeLayer(activeIncidentMarker);
  }
  activeIncidentMarker = null;
  activeIncidentKey = '';
  activeIncidentAlert = null;
  updateKioskOperationStrip();
  returnToHomeView();
}

function showTemporaryIncidentMarker(alert) {
  if (!map || !alert) return;

  const lat = normalizeIncidentCoordinate(alert.latitude);
  const lon = normalizeIncidentCoordinate(alert.longitude);
  const key = incidentKey(alert);

  activeIncidentAlert = alert;
  activeIncidentKey = key;
  updateKioskOperationStrip(alert);

  if (activeIncidentMarkerTimer) clearTimeout(activeIncidentMarkerTimer);

  if (lat !== null && lon !== null) {
    if (activeIncidentMarker) map.removeLayer(activeIncidentMarker);

    const address = [alert.address, alert.unit].filter(Boolean).join(' ');
    const icon = L.divIcon({
      className: '',
      html: `<div class="incident-map-marker"><span>!</span></div>`,
      iconSize: [46, 46],
      iconAnchor: [23, 23]
    });

    activeIncidentMarker = L.marker([lat, lon], {
      icon,
      zIndexOffset: 30000,
      interactive: !IS_KIOSK_MODE
    }).addTo(map);

    activeIncidentMarker.bindTooltip(
      `<strong>${escapeHtml(alert.description || 'Emergency Call')}</strong><br>${escapeHtml(address || 'Location unavailable')}`,
      { direction: 'top', offset: [0, -22], permanent: false }
    );

    if (IS_KIOSK_MODE) {
      map.setView([lat, lon], Math.max(map.getZoom(), 14), { animate: false });
      setTimeout(returnToHomeView, DASHBOARD_CONFIG.kioskIncidentFocusMs);
    }
  }

  activeIncidentMarkerTimer = setTimeout(
    clearTemporaryIncidentMarker,
    DASHBOARD_CONFIG.active911IncidentMarkerDurationMs
  );
}

/* Active911 popup integration */
let active911BaselineReady = false;
let active911LatestId = '';
let active911PopupOpen = false;
let active911DismissTimer = null;
let active911Audio = null;
let pendingActive911Sound = false;
let active911AudioRetryTimer = null;
const ACTIVE911_LAST_SEEN_KEY = 'wtfd-last-seen-active911-id';

function getActive911Audio() {
  if (!DASHBOARD_CONFIG.alertSoundEnabled || !DASHBOARD_CONFIG.alertSoundUrl) {
    return null;
  }

  if (!active911Audio) {
    active911Audio = new Audio(DASHBOARD_CONFIG.alertSoundUrl);
    active911Audio.preload = 'auto';
    active911Audio.load();
  }

  active911Audio.volume = Math.min(
    1,
    Math.max(0, Number(DASHBOARD_CONFIG.alertSoundVolume) || 0)
  );

  return active911Audio;
}

function wasIncidentSoundPlayed(id) {
  if (!DASHBOARD_CONFIG.alertSoundPlayOncePerIncident || !id) return false;

  try {
    return localStorage.getItem(DASHBOARD_CONFIG.alertSoundStorageKey) === String(id);
  } catch (error) {
    return false;
  }
}

function rememberIncidentSound(id) {
  if (!DASHBOARD_CONFIG.alertSoundPlayOncePerIncident || !id) return;

  try {
    localStorage.setItem(DASHBOARD_CONFIG.alertSoundStorageKey, String(id));
  } catch (error) {
    // Storage may be unavailable in a locked-down kiosk browser.
  }
}

async function playActive911Sound(alert) {
  const id = String(alert?.id || '');
  const audio = getActive911Audio();

  if (!audio || wasIncidentSoundPlayed(id)) return;

  try {
    audio.currentTime = 0;
    await audio.play();
    pendingActive911Sound = false;
    rememberIncidentSound(id);
  } catch (error) {
    // Standard browsers can block autoplay until the page receives one user action.
    // Fully Kiosk Browser can be configured to permit media autoplay.
    pendingActive911Sound = true;
    console.warn('Active911 alert sound was blocked:', error);
  }
}

function retryActive911SoundDuringPopup(alert) {
  if (active911AudioRetryTimer) clearInterval(active911AudioRetryTimer);
  let attempts = 0;
  active911AudioRetryTimer = setInterval(() => {
    attempts++;
    if (!pendingActive911Sound || attempts >= 10 || !active911PopupOpen) {
      clearInterval(active911AudioRetryTimer);
      active911AudioRetryTimer = null;
      return;
    }
    playActive911Sound(alert);
  }, 1000);
}

function retryPendingActive911Sound() {
  if (!pendingActive911Sound || !activeIncidentAlert) return;
  playActive911Sound(activeIncidentAlert);
}

['pointerdown', 'keydown', 'touchstart'].forEach(eventName => {
  document.addEventListener(eventName, retryPendingActive911Sound, {
    once: false,
    passive: true
  });
});

function active911SetText(id, value) {
  const element = document.getElementById(id);
  if (element) element.textContent = value || '';
}

function active911SetOptional(id, value) {
  const element = document.getElementById(id);
  if (!element) return;

  const hasValue = Boolean(String(value || '').trim());
  element.hidden = !hasValue;
  element.textContent = hasValue ? value : '';
}

function active911DisplayDetails(value) {
  return String(value || '')
    .split(/\r?\n/)
    .filter(line => !/^\s*(?:area|sector|beat)\s*:/i.test(line))
    .join('\n')
    .replace(/^\s+|\s+$/g, '')
    .replace(/\n{3,}/g, '\n\n');
}

function setActive911DetailsDensity(value) {
  const element = document.getElementById('active911Details');
  if (!element) return;
  const length = String(value || '').length;
  element.classList.toggle('compact', length > 350);
  element.classList.toggle('dense', length > 650);
}

function storedActive911Id() {
  try {
    return localStorage.getItem(ACTIVE911_LAST_SEEN_KEY) || '';
  } catch (_) {
    return '';
  }
}

function rememberActive911Id(id) {
  try {
    localStorage.setItem(ACTIVE911_LAST_SEEN_KEY, String(id || ''));
  } catch (_) {
    // Continue with in-memory duplicate protection when storage is unavailable.
  }
}

function active911FormatTime(value) {
  if (!value) return '';

  const parsed = parseIncidentTimestamp(value);
  const date = new Date(parsed);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    timeZone: DASHBOARD_CONFIG.active911TimeZone
  });
}

function parseIncidentTimestamp(value) {
  if (value === null || value === undefined || value === '') return null;

  if (typeof value === 'number' || /^\d+(?:\.\d+)?$/.test(String(value).trim())) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return null;
    // Active911 integrations may provide Unix seconds or JavaScript milliseconds.
    return numeric < 1e12 ? numeric * 1000 : numeric;
  }

  const text = String(value).trim();
  const unzonedMatch = text.match(
    /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?(?:\.(\d{1,3}))?$/
  );
  let parsed;

  // Active911 supplies UTC timestamps without a Z/offset. Parse those fields
  // explicitly as UTC, then let the browser format them in the kiosk timezone.
  if (unzonedMatch) {
    const [, year, month, day, hour, minute, second = '0', fraction = '0'] = unzonedMatch;
    parsed = Date.UTC(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hour),
      Number(minute),
      Number(second),
      Number(fraction.padEnd(3, '0'))
    );
  } else {
    parsed = new Date(text).getTime();
  }

  return Number.isFinite(parsed) ? parsed : null;
}

function incidentReceivedTime(alert) {
  const candidates = [
    alert?.received,
    alert?.receivedAt,
    alert?.received_at,
    alert?.timestamp,
    alert?.createdAt,
    alert?.created_at
  ];

  const now = Date.now();
  for (const candidate of candidates) {
    const parsed = parseIncidentTimestamp(candidate);
    if (!Number.isFinite(parsed)) continue;

    // A future timestamp normally indicates a missing/incorrect timezone.
    // Start the elapsed timer when this browser first saw the incident.
    if (parsed > now + 30 * 1000) return now;
    return parsed;
  }

  return now;
}

function incidentAgeText(timestamp) {
  const seconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
  if (seconds < 60) return 'Dispatched less than a minute ago';
  const minutes = Math.floor(seconds / 60);
  return `Dispatched ${minutes} minute${minutes === 1 ? '' : 's'} ago`;
}

function incidentElapsedText(timestamp) {
  const totalSeconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')} elapsed`;
  }

  return `${minutes}:${String(seconds).padStart(2, '0')} elapsed`;
}

function addIncidentToBanner(alert) {
  if (!alert) return;
  const key = incidentKey(alert) || String(Date.now());

  // Active911 may return the same alert on every poll. Calculate its start time
  // only once so a fallback time is not reset every five seconds.
  let timestamp = incidentStartTimes.get(key);
  if (!Number.isFinite(timestamp)) {
    timestamp = incidentReceivedTime(alert);
    incidentStartTimes.set(key, timestamp);
  }

  activeIncidents = activeIncidents.filter(item => item.key !== key);
  activeIncidents.unshift({ key, alert, timestamp });
  activeIncidents = activeIncidents.slice(0, DASHBOARD_CONFIG.active911BannerMaxItems);
  renderIncidentBanner();
}

function renderIncidentBanner() {
  const banner = document.getElementById('incidentBanner');
  const track = document.getElementById('incidentBannerTrack');
  if (!banner || !track) return;

  const cutoff = Date.now() - DASHBOARD_CONFIG.active911BannerDurationMs;
  activeIncidents = activeIncidents.filter(item => item.timestamp >= cutoff);
  banner.hidden = activeIncidents.length === 0;
  document.body.classList.toggle('has-incident-banner', activeIncidents.length > 0);

  track.innerHTML = activeIncidents.map(item => {
    const alert = item.alert;
    const location = [alert.address, alert.unit, alert.city].filter(Boolean).join(' ');
    return `<article class="incident-banner-card">
      <div class="incident-banner-icon">!</div>
      <div class="incident-banner-copy">
        <strong>${escapeHtml(alert.description || 'Emergency Call')}</strong>
        <span>${escapeHtml(location || alert.place || 'Location unavailable')}</span>
        <small><b>${escapeHtml(incidentElapsedText(item.timestamp))}</b> • ${escapeHtml(incidentAgeText(item.timestamp))}</small>
      </div>
    </article>`;
  }).join('');
}

setInterval(renderIncidentBanner, 1000);

function showActive911Alert(alert) {
  const overlay = document.getElementById('active911Overlay');
  if (!overlay || !alert) return;

  active911SetText(
    'active911Description',
    alert.description || 'Emergency Call'
  );

  active911SetOptional('active911Place', alert.place);

  const address = [alert.address, alert.unit]
    .filter(Boolean)
    .join(' ');

  active911SetText(
    'active911Address',
    address || 'Address unavailable'
  );

  active911SetText(
    'active911City',
    [alert.city, alert.state].filter(Boolean).join(', ')
  );

  active911SetOptional(
    'active911CrossStreet',
    alert.crossStreet
      ? `Cross streets: ${alert.crossStreet}`
      : ''
  );

  active911SetOptional('active911Units', alert.units);
  const displayDetails = active911DisplayDetails(alert.details);
  active911SetOptional('active911Details', displayDetails);
  setActive911DetailsDensity(displayDetails);

  const unitsCard = document.getElementById('active911UnitsCard');
  const detailsCard = document.getElementById('active911DetailsCard');

  if (unitsCard) unitsCard.hidden = !String(alert.units || '').trim();
  if (detailsCard) detailsCard.hidden = !displayDetails;

  active911SetText(
    'active911Received',
    alert.received
      ? `Received ${active911FormatTime(alert.received)}`
      : ''
  );

  overlay.hidden = false;
  active911PopupOpen = true;
  activeIncidentAlert = alert;
  showTemporaryIncidentMarker(alert);
  addIncidentToBanner(alert);
  playActive911Sound(alert);
  retryActive911SoundDuringPopup(alert);

  if (active911DismissTimer) {
    clearTimeout(active911DismissTimer);
  }

  active911DismissTimer = setTimeout(() => {
    dismissActive911Alert();
  }, DASHBOARD_CONFIG.active911PopupDurationMs);

  const dismissButton = document.getElementById('active911Dismiss');
  if (dismissButton && !IS_KIOSK_MODE) dismissButton.focus();
}

function dismissActive911Alert() {
  const overlay = document.getElementById('active911Overlay');
  if (overlay) overlay.hidden = true;
  active911PopupOpen = false;

  if (active911AudioRetryTimer) {
    clearInterval(active911AudioRetryTimer);
    active911AudioRetryTimer = null;
  }

  if (active911DismissTimer) {
    clearTimeout(active911DismissTimer);
    active911DismissTimer = null;
  }

  returnToHomeView();
}

async function checkActive911Alerts() {
  try {
    const response = await fetch('/api/active911', {
      cache: 'no-store'
    });

    if (!response.ok) {
      throw new Error(`Active911 request failed: ${response.status}`);
    }

    const data = await response.json();
    const alert = data.alert;

    if (!alert || !alert.id) return;

    if (!active911BaselineReady) {
      const id = String(alert.id);
      const previouslySeenId = storedActive911Id();
      const receivedAt = incidentReceivedTime(alert);
      const isRecent = Date.now() - receivedAt <= DASHBOARD_CONFIG.active911StartupPopupMaxAgeMs;
      active911LatestId = id;
      active911BaselineReady = true;
      rememberActive911Id(id);
      if (id !== previouslySeenId && isRecent) {
        showActive911Alert(alert);
      }
      return;
    }

    const id = String(alert.id);

    if (id !== active911LatestId) {
      active911LatestId = id;
      rememberActive911Id(id);
      showActive911Alert(alert);
    }
  } catch (error) {
    console.warn('Active911 popup check failed:', error);
  }
}

const active911DismissButton =
  document.getElementById('active911Dismiss');

if (active911DismissButton) {
  active911DismissButton.addEventListener(
    'click',
    dismissActive911Alert
  );
}

document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && active911PopupOpen) {
    dismissActive911Alert();
  }
});

checkActive911Alerts();
setInterval(
  checkActive911Alerts,
  DASHBOARD_CONFIG.active911PollMs
);


/* Kiosk-mode unattended display safeguards */
if (IS_KIOSK_MODE) {
  document.addEventListener('mousemove', showKioskCursorTemporarily);
  document.addEventListener('mousedown', showKioskCursorTemporarily);
  document.addEventListener('touchstart', showKioskCursorTemporarily, { passive: true });
  showKioskCursorTemporarily();

  setInterval(
    returnToHomeView,
    DASHBOARD_CONFIG.kioskHomeResetMs
  );

  setTimeout(() => {
    window.location.reload();
  }, DASHBOARD_CONFIG.kioskAutoReloadMs);
}

// Recover promptly when a kiosk regains connectivity or the browser becomes
// visible again after the display device wakes. The normal polling intervals
// remain in place, so these are safe one-time refresh requests.
window.addEventListener('online', () => {
  loadDashboard();
  checkActive911Alerts();
});

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible') return;
  loadDashboard();
  checkActive911Alerts();
});

setInterval(() => {
  if (!lastSuccessfulDashboardRefresh) return;

  const age = Date.now() - lastSuccessfulDashboardRefresh;
  const ageText = formatConnectionAge(age);

  if (age >= DASHBOARD_CONFIG.connectionLostMs) {
    setConnectionState('lost', `● OFFLINE — last update ${ageText}`);
  } else if (age >= DASHBOARD_CONFIG.connectionDelayedMs) {
    setConnectionState('delayed', `● DELAYED — updated ${ageText}`);
  } else {
    setConnectionState('online', `● LIVE — updated ${ageText}`);
  }
}, 1000);
