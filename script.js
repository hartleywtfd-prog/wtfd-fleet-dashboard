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
    settings.dashboardCenterLat || 39.6255
  );

  const centerLon = Number(
    settings.dashboardCenterLon || -84.1750
  );

  const zoom = Number(
    settings.dashboardZoom || 12
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
  return Boolean(
    v && v.emergencyLights === true
  );
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
    viewBox="0 0 64 64"
    aria-hidden="true"
    focusable="false"
  `;

  if (type === 'engine') {
    return `
      <svg ${common}>
        <rect x="8" y="25" width="34" height="19" rx="3" fill="currentColor"/>
        <rect x="42" y="29" width="12" height="15" rx="2" fill="currentColor"/>
        <rect x="13" y="18" width="24" height="7" rx="2" fill="currentColor"/>
        <rect x="18" y="13" width="14" height="4" rx="1" fill="currentColor"/>
        <circle cx="19" cy="47" r="5" fill="currentColor"/>
        <circle cx="47" cy="47" r="5" fill="currentColor"/>
        <rect x="46" y="32" width="6" height="5" rx="1" fill="#0f172a"/>
      </svg>
    `;
  }

  if (type === 'medic') {
    return `
      <svg ${common}>
        <rect x="8" y="24" width="42" height="21" rx="4" fill="currentColor"/>
        <rect x="48" y="29" width="8" height="16" rx="2" fill="currentColor"/>
        <circle cx="19" cy="48" r="5" fill="currentColor"/>
        <circle cx="47" cy="48" r="5" fill="currentColor"/>
        <rect x="26" y="27" width="6" height="15" fill="#ffffff"/>
        <rect x="21.5" y="31.5" width="15" height="6" fill="#ffffff"/>
      </svg>
    `;
  }

  if (
    type === 'chief' ||
    type === 'battalion'
  ) {
    return `
      <svg ${common}>
        <path d="M10 37 L16 25 H44 L54 37 V45 H10 Z" fill="currentColor"/>
        <rect x="21" y="18" width="16" height="5" rx="2" fill="currentColor"/>
        <circle cx="20" cy="47" r="5" fill="currentColor"/>
        <circle cx="46" cy="47" r="5" fill="currentColor"/>
        <rect x="20" y="27" width="10" height="7" rx="1" fill="#0f172a"/>
        <rect x="32" y="27" width="10" height="7" rx="1" fill="#0f172a"/>
      </svg>
    `;
  }

  if (type === 'ladder') {
    return `
      <svg ${common}>
        <rect x="8" y="29" width="43" height="16" rx="3" fill="currentColor"/>
        <circle cx="18" cy="48" r="5" fill="currentColor"/>
        <circle cx="45" cy="48" r="5" fill="currentColor"/>
        <path d="M15 16 L47 8 L49 13 L17 21 Z" fill="currentColor"/>
        <rect x="18" y="20" width="28" height="3" transform="rotate(-14 18 20)" fill="#ffffff"/>
      </svg>
    `;
  }

  if (type === 'crrd') {
    return `
      <svg ${common}>
        <path d="M32 7 L49 14 V28 C49 40 42 49 32 56 C22 49 15 40 15 28 V14 Z" fill="currentColor"/>
        <path d="M32 17 L36 25 L45 26 L38 32 L40 41 L32 36 L24 41 L26 32 L19 26 L28 25 Z" fill="#ffffff"/>
      </svg>
    `;
  }

  return `
    <svg ${common}>
      <path d="M10 37 L16 25 H44 L54 37 V45 H10 Z" fill="currentColor"/>
      <circle cx="20" cy="47" r="5" fill="currentColor"/>
      <circle cx="46" cy="47" r="5" fill="currentColor"/>
    </svg>
  `;
}

function markerColor(v, status) {
  if (status === 'responding') {
    return '#dc2626';
  }

  if (status === 'moving') {
    return '#2563eb';
  }

  if (status === 'away') {
    return '#d97706';
  }

  if (status === 'stale') {
    return '#dc2626';
  }

  if (status === 'nogps') {
    return '#64748b';
  }

  if (status === 'offline') {
    return '#9333ea';
  }

  const type = String(
    v.type || ''
  ).toLowerCase();

  if (type === 'engine') return '#dc2626';
  if (type === 'medic') return '#2563eb';
  if (type === 'ladder') return '#475569';
  if (type === 'battalion') return '#ea580c';
  if (type === 'chief') return '#7c3aed';
  if (type === 'crrd') return '#16a34a';

  return '#16a34a';
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
  }

  return L.divIcon({
    className: '',
    html: `
      <div
        class="marker-tag${statusClass}"
        style="background:${markerColor(v, status)}"
      >
        <span class="marker-svg">
          ${apparatusSvg(v)}
        </span>
        <span>${shortLabel(v)}</span>
      </div>
    `,
    iconSize: [90, 46],
    iconAnchor: [45, 23]
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

  const bounds = [];

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

        bounds.push([
          displayLat,
          displayLon
        ]);
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

  if (bounds.length > 0) {
    map.fitBounds(
      bounds,
      {
        padding: [65, 65]
      }
    );
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
  30000
);
