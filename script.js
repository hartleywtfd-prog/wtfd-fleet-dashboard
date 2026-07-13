/* ===== User-adjustable dashboard settings ===== */
const DASHBOARD_CONFIG = {
  defaultCenterLat: 39.6255,
  defaultCenterLon: -84.1656,
  minimumMapZoom: 13,
  dashboardRefreshMs: 30000,
  active911PollMs: 5000,
  active911PopupDurationMs: 15000
};

let map;
let markers = {};
let allLocations = [];
let activeBaseLayer = 'street';
let baseLayers = {};

function apiRequest(action) {
  const url = action === 'sync' ? '/api/sync' : '/api/dashboard';

  return fetch(url, { cache: 'no-store' }).then(response => {
    if (!response.ok) {
      throw new Error('API request failed: ' + response.status);
    }

    return response.json();
  });
}

function createBaseLayers() {
  baseLayers = {
    street: L.tileLayer(
      'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
      {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap'
      }
    ),

    dark: L.tileLayer(
      'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
      {
        subdomains: 'abcd',
        maxZoom: 20,
        attribution:
          '&copy; OpenStreetMap contributors &copy; CARTO'
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
  baseLayers.street.addTo(map);
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
  const clock = document.getElementById('clock');

  if (clock) {
    clock.innerText =
      new Date().toLocaleTimeString();
  }
}

setInterval(updateClock, 1000);
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
    return 'Stale';
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
  const type = String(
    v.type || ''
  ).toLowerCase();

  const common = `
    viewBox="0 0 72 48"
    aria-hidden="true"
    focusable="false"
  `;

  /*
   * Engine: unmistakable pumper silhouette with square body,
   * cab, pump panel, roof lights, and dual rear wheel cue.
   */
  if (type === 'engine') {
    return `
      <svg ${common}>
        <rect x="5" y="18" width="43" height="20" rx="3" fill="currentColor"/>
        <path d="M48 23 H60 L67 30 V38 H48 Z" fill="currentColor"/>
        <rect x="10" y="12" width="30" height="6" rx="2" fill="currentColor"/>
        <rect x="15" y="8" width="20" height="3" rx="1.5" fill="currentColor"/>
        <rect x="25" y="21" width="10" height="13" rx="1" fill="#0f172a"/>
        <circle cx="18" cy="40" r="5" fill="currentColor"/>
        <circle cx="40" cy="40" r="5" fill="currentColor"/>
        <circle cx="59" cy="40" r="5" fill="currentColor"/>
        <rect x="53" y="26" width="8" height="6" rx="1" fill="#0f172a"/>
        <rect x="8" y="22" width="11" height="3" rx="1" fill="#ffffff" opacity=".9"/>
        <rect x="8" y="28" width="11" height="3" rx="1" fill="#ffffff" opacity=".9"/>
      </svg>
    `;
  }

  /*
   * Medic: box-style ambulance with prominent medical cross.
   */
  if (type === 'medic') {
    return `
      <svg ${common}>
        <rect x="5" y="15" width="47" height="23" rx="4" fill="currentColor"/>
        <path d="M52 23 H62 L68 30 V38 H52 Z" fill="currentColor"/>
        <circle cx="18" cy="40" r="5" fill="currentColor"/>
        <circle cx="47" cy="40" r="5" fill="currentColor"/>
        <circle cx="61" cy="40" r="5" fill="currentColor"/>
        <rect x="25" y="19" width="7" height="15" fill="#ffffff"/>
        <rect x="21" y="23" width="15" height="7" fill="#ffffff"/>
        <rect x="56" y="26" width="7" height="6" rx="1" fill="#0f172a"/>
        <rect x="10" y="11" width="14" height="3" rx="1.5" fill="currentColor"/>
      </svg>
    `;
  }

  /*
   * Ladder: long aerial ladder and turntable are visually distinct.
   */
  if (type === 'ladder') {
    return `
      <svg ${common}>
        <rect x="5" y="23" width="49" height="15" rx="3" fill="currentColor"/>
        <path d="M54 27 H63 L68 32 V38 H54 Z" fill="currentColor"/>
        <circle cx="17" cy="40" r="5" fill="currentColor"/>
        <circle cx="43" cy="40" r="5" fill="currentColor"/>
        <circle cx="61" cy="40" r="5" fill="currentColor"/>
        <circle cx="34" cy="23" r="4" fill="#ffffff"/>
        <path d="M12 16 L58 5 L60 10 L14 21 Z" fill="currentColor"/>
        <path d="M16 16.5 L56 7" stroke="#ffffff" stroke-width="2.2" stroke-linecap="round"/>
        <path d="M22 15 L24 19 M31 13 L33 17 M40 11 L42 15 M49 9 L51 13"
          stroke="#ffffff" stroke-width="1.6" stroke-linecap="round"/>
      </svg>
    `;
  }

  /*
   * Command: Tahoe/SUV profile with light bar.
   */
  if (
    type === 'chief' ||
    type === 'battalion'
  ) {
    return `
      <svg ${common}>
        <path d="M8 30 L15 18 H45 L55 24 H62 L68 31 V38 H8 Z" fill="currentColor"/>
        <circle cx="20" cy="40" r="5" fill="currentColor"/>
        <circle cx="56" cy="40" r="5" fill="currentColor"/>
        <rect x="24" y="12" width="18" height="4" rx="2" fill="currentColor"/>
        <path d="M18 20 H31 V28 H14 Z" fill="#0f172a"/>
        <path d="M33 20 H44 L51 28 H33 Z" fill="#0f172a"/>
        <rect x="59" y="29" width="5" height="3" rx="1" fill="#ffffff"/>
      </svg>
    `;
  }

  /*
   * CRRD / Prevention: pickup silhouette to distinguish it from command.
   */
  if (type === 'crrd') {
    return `
      <svg ${common}>
        <path d="M7 29 L14 19 H36 L45 25 H62 L68 31 V38 H7 Z" fill="currentColor"/>
        <circle cx="19" cy="40" r="5" fill="currentColor"/>
        <circle cx="57" cy="40" r="5" fill="currentColor"/>
        <path d="M17 21 H29 V28 H13 Z" fill="#0f172a"/>
        <path d="M31 21 H36 L42 28 H31 Z" fill="#0f172a"/>
        <rect x="46" y="27" width="15" height="3" rx="1" fill="#ffffff" opacity=".9"/>
      </svg>
    `;
  }

  return `
    <svg ${common}>
      <path d="M8 30 L15 18 H45 L55 24 H62 L68 31 V38 H8 Z" fill="currentColor"/>
      <circle cx="20" cy="40" r="5" fill="currentColor"/>
      <circle cx="56" cy="40" r="5" fill="currentColor"/>
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
  const unit = String(v.unit || '');
  const match = unit.match(/\d+/);
  const number = match ? match[0] : '';

  const type = String(
    v.type || ''
  ).toLowerCase();

  if (type === 'medic') return 'M' + number;
  if (type === 'engine') return 'E' + number;
  if (type === 'ladder') return 'L' + number;
  if (type === 'battalion') return 'B' + number;
  if (type === 'chief') return 'C' + number;

  if (type === 'crrd') {
    return unit
      .replace('Prevention ', 'P')
      .replace('Marshal ', 'FM')
      .substring(0, 5);
  }

  return unit.substring(0, 5);
}

function markerIcon(v, status) {
  let statusClass = '';

  if (status === 'responding') {
    statusClass = ' respondingMarker';
  } else if (status === 'moving') {
    statusClass = ' movingMarker';
  } else if (status === 'away') {
    statusClass = ' awayMarker';
  }

  const shapeClass = markerShapeClass(v);

  return L.divIcon({
    className: '',
    html: `
      <div
        class="marker-tag${shapeClass}${statusClass}"
        style="background:${markerColor(v, status)}"
      >
        <span class="marker-svg">
          ${apparatusSvg(v)}
        </span>
        <span class="marker-label">${shortLabel(v)}</span>
      </div>
    `,
    iconSize: [96, 44],
    iconAnchor: [48, 22]
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

function groupKey(v) {
  if (
    v.facility &&
    v.facility !== 'Away' &&
    v.facility !== 'Unknown'
  ) {
    return 'FACILITY:' + v.facility;
  }

  return (
    'GPS:' +
    Number(v.lat).toFixed(4) +
    ',' +
    Number(v.lon).toFixed(4)
  );
}

function buildGroups(locations) {
  const groups = {};

  locations.forEach(v => {
    const key = groupKey(v);

    if (!groups[key]) {
      groups[key] = [];
    }

    groups[key].push(v);
  });

  return groups;
}

function getGroupAnchor(group) {
  let lat = 0;
  let lon = 0;

  group.forEach(v => {
    lat += Number(v.lat);
    lon += Number(v.lon);
  });

  return [
    lat / group.length,
    lon / group.length
  ];
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

    if (sA !== sB) {
      return sA - sB;
    }

    const tA =
      typePriority[
        String(a.type || '').toLowerCase()
      ] || 99;

    const tB =
      typePriority[
        String(b.type || '').toLowerCase()
      ] || 99;

    if (tA !== tB) {
      return tA - tB;
    }

    return String(
      a.unit || ''
    ).localeCompare(
      String(b.unit || '')
    );
  });
}

/*
 * Parking-grid layout for facilities.
 * The highest-priority unit occupies the first slot.
 * Shared facilities spread into a compact bay-style grid.
 */
function getFacilityParkingOffset(
  anchorLat,
  anchorLon,
  index,
  total
) {
  if (total <= 1) {
    return [anchorLat, anchorLon];
  }

  const columns =
    total <= 4 ? 2 : 3;

  const row = Math.floor(
    index / columns
  );

  const col = index % columns;

  const rows = Math.ceil(
    total / columns
  );

  const latSpacing = 0.00058;
  const lonSpacing = 0.00088;

  const colOffset =
    col - (columns - 1) / 2;

  const rowOffset =
    row - (rows - 1) / 2;

  return [
    anchorLat - rowOffset * latSpacing,
    anchorLon + colOffset * lonSpacing
  ];
}

function getGpsFanOffset(
  anchorLat,
  anchorLon,
  index,
  total
) {
  if (total <= 1 || index === 0) {
    return [anchorLat, anchorLon];
  }

  const adjustedIndex = index - 1;
  const firstRingCapacity = 6;

  const ring =
    adjustedIndex < firstRingCapacity
      ? 1
      : 2;

  const ringIndex =
    ring === 1
      ? adjustedIndex
      : adjustedIndex -
        firstRingCapacity;

  const ringCount =
    ring === 1
      ? Math.min(
          total - 1,
          firstRingCapacity
        )
      : Math.max(
          total - 1 -
          firstRingCapacity,
          1
        );

  const angle =
    -Math.PI / 2 +
    (2 * Math.PI * ringIndex) /
      ringCount;

  const latSpacing =
    ring === 1 ? 0.00062 : 0.00103;

  const lonSpacing =
    ring === 1 ? 0.00088 : 0.00146;

  return [
    anchorLat +
      Math.sin(angle) *
        latSpacing,
    anchorLon +
      Math.cos(angle) *
        lonSpacing
  ];
}

function getDisplayPosition(
  key,
  anchorLat,
  anchorLon,
  index,
  total
) {
  if (key.startsWith('FACILITY:')) {
    return getFacilityParkingOffset(
      anchorLat,
      anchorLon,
      index,
      total
    );
  }

  return getGpsFanOffset(
    anchorLat,
    anchorLon,
    index,
    total
  );
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
  clearMarkers();

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

  const groups = buildGroups(filtered);
  const metrics = buildFleetMetrics(
    locations
  );

  let gps = 0;
  let noGps = 0;
  let stale = 0;


  Object.keys(groups).forEach(key => {
    const originalGroup = groups[key];

    const layoutGroup =
      sortGroupForLayout(
        originalGroup
      );

    const [anchorLat, anchorLon] =
      getGroupAnchor(
        originalGroup
      );

    layoutGroup.forEach(
      (v, index) => {
        const status = getStatus(v);

        const [
          displayLat,
          displayLon
        ] = getDisplayPosition(
          key,
          anchorLat,
          anchorLon,
          index,
          layoutGroup.length
        );

        const gpsStatus = String(
          v.gpsStatus || ''
        ).toLowerCase();

        if (gpsStatus === 'gps') {
          gps++;
        }

        if (gpsStatus === 'no gps') {
          noGps++;
        }

        if (status === 'stale') {
          stale++;
        }

        const marker = L.marker(
          [
            displayLat,
            displayLon
          ],
          {
            icon: markerIcon(
              v,
              status
            ),
            zIndexOffset:
              markerZIndex(
                v,
                status
              )
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
          ${
            v.mapLink
              ? `<a href="${escapeHtml(v.mapLink)}" target="_blank" rel="noopener noreferrer">Open in Google Maps</a>`
              : ''
          }
        `);

        markers[
          v.rawName +
          '-' +
          v.unit
        ] = marker;

      }
    );
  });

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
            v.facility ||
            v.homeStation ||
            'Unknown'
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

  if (refresh) {
    refresh.innerText =
      'Last refreshed: ' +
      new Date()
        .toLocaleTimeString();
  }

  /*
   * Keep the map at its configured response-area center and zoom.
   * Distant apparatus remain available in the apparatus list but
   * will not force the map to zoom out.
   */
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

function loadDashboard() {
  apiRequest('dashboard')
    .then(data => {
      const settings =
        data.settings || {};

      allLocations =
        data.locations || [];

      if (!map) {
        initMap(settings);
      }

      renderDashboard(
        allLocations
      );
    })
    .catch(error => {
      const refresh =
        document.getElementById(
          'lastRefresh'
        );

      if (refresh) {
        refresh.innerText =
          'Error: ' +
          error.message;
      }
    });
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
setInterval(
  loadDashboard,
  DASHBOARD_CONFIG.dashboardRefreshMs
);

/* Active911 popup integration */
let active911BaselineReady = false;
let active911LatestId = '';
let active911PopupOpen = false;
let active911DismissTimer = null;

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

function active911FormatTime(value) {
  if (!value) return '';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit'
  });
}

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
  active911SetOptional('active911Details', alert.details);

  const unitsCard = document.getElementById('active911UnitsCard');
  const detailsCard = document.getElementById('active911DetailsCard');

  if (unitsCard) unitsCard.hidden = !String(alert.units || '').trim();
  if (detailsCard) detailsCard.hidden = !String(alert.details || '').trim();

  active911SetText(
    'active911Received',
    alert.received
      ? `Received ${active911FormatTime(alert.received)}`
      : ''
  );

  overlay.hidden = false;
  active911PopupOpen = true;

  if (active911DismissTimer) {
    clearTimeout(active911DismissTimer);
  }

  active911DismissTimer = setTimeout(() => {
    dismissActive911Alert();
  }, DASHBOARD_CONFIG.active911PopupDurationMs);

  const dismissButton = document.getElementById('active911Dismiss');
  if (dismissButton) dismissButton.focus();
}

function dismissActive911Alert() {
  const overlay = document.getElementById('active911Overlay');
  if (overlay) overlay.hidden = true;
  active911PopupOpen = false;

  if (active911DismissTimer) {
    clearTimeout(active911DismissTimer);
    active911DismissTimer = null;
  }
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
      active911LatestId = String(alert.id);
      active911BaselineReady = true;
      return;
    }

    const id = String(alert.id);

    if (id !== active911LatestId) {
      active911LatestId = id;
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
