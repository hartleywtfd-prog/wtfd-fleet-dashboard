const APPS_SCRIPT_API_URL =
  'https://script.google.com/macros/s/AKfycbwhinuB6R-rxHMG4lSkilihzVcFUrGXOQNbhYLrNQfksn-Yy5nxOPFyaUNnRhlpIhRGhw/exec?mode=json';

let map;
let markers = {};
let allLocations = [];

function apiRequest(action) {
  const url = action === 'sync' ? '/api/sync' : '/api/dashboard';

  return fetch(url, { cache: 'no-store' }).then(response => {
    if (!response.ok) {
      throw new Error('API request failed: ' + response.status);
    }

    return response.json();
  });
}

function initMap(settings) {
  const centerLat = Number(settings.dashboardCenterLat || 39.6255);
  const centerLon = Number(settings.dashboardCenterLon || -84.1750);
  const zoom = Number(settings.dashboardZoom || 12);

  map = L.map('map', {
    zoomControl: true
  }).setView([centerLat, centerLon], zoom);

  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap'
  }).addTo(map);
}

function updateClock() {
  const clock = document.getElementById('clock');

  if (clock) {
    clock.innerText = new Date().toLocaleTimeString();
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

  return (new Date() - parsed) / 60000;
}

function hasEmergencyLights(v) {
  return v && v.emergencyLights === true;
}

function getStatus(v) {
  const speed = Number(v.speed || 0);
  const gpsStatus = String(v.gpsStatus || '').toLowerCase();
  const facility = String(v.facility || '');
  const age = ageMinutes(v.lastUpdate);

  if (hasEmergencyLights(v)) return 'responding';
  if (gpsStatus === 'no gps') return 'nogps';
  if (gpsStatus === 'gps offline') return 'offline';
  if (age > 120 && gpsStatus === 'gps') return 'stale';
  if (speed >= 5) return 'moving';
  if (facility && facility !== 'Away' && facility !== 'Unknown') return 'defined';

  return 'away';
}

function statusText(status, v) {
  const facility = String(v.facility || '').toLowerCase();

  if (status === 'responding') return 'Responding';
  if (status === 'nogps') return 'No GPS';
  if (status === 'offline') return 'Offline';
  if (status === 'moving') return 'Moving';
  if (status === 'stale') return 'Stale';
  if (status === 'away') return 'Away';

  if (facility.includes('headquarters')) return 'HQ';
  if (facility.includes('maintenance')) return 'Fire Maintenance';
  if (facility.includes('station')) return 'Station';
  if (facility.includes('hospital') || facility.includes('health')) return 'Hospital';

  return 'Located';
}

function markerColor(v, status) {
  if (status === 'responding') return '#dc2626';
  if (status === 'moving') return '#2563eb';
  if (status === 'away') return '#d97706';
  if (status === 'stale') return '#dc2626';
  if (status === 'nogps') return '#64748b';
  if (status === 'offline') return '#9333ea';

  const type = String(v.type || '').toLowerCase();

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
  const type = String(v.type || '').toLowerCase();

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
        ${shortLabel(v)}
      </div>
    `,
    iconSize: [78, 46],
    iconAnchor: [39, 23]
  });
}

function markerZIndex(v, status) {
  const type = String(v.type || '').toLowerCase();

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
  if (!time) return 'No GPS';

  const parsed = new Date(time);

  if (Number.isNaN(parsed.getTime())) {
    return 'Unknown';
  }

  const seconds = Math.max(
    0,
    Math.round((new Date() - parsed) / 1000)
  );

  if (seconds < 30) return 'Just now';
  if (seconds < 60) return seconds + ' sec ago';

  const minutes = Math.round(seconds / 60);

  if (minutes === 1) return '1 min ago';
  if (minutes < 60) return minutes + ' min ago';

  const hours = Math.round(minutes / 60);

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

function sortGroupForLayout(group) {
  const priority = {
    responding: 1,
    moving: 2,
    away: 3,
    stale: 4,
    defined: 5,
    offline: 6,
    nogps: 7
  };

  const typePriority = {
    chief: 1,
    battalion: 2,
    engine: 3,
    medic: 4,
    ladder: 5,
    crrd: 6
  };

  return group.slice().sort((a, b) => {
    const sA = priority[getStatus(a)] || 99;
    const sB = priority[getStatus(b)] || 99;

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

    return String(a.unit || '').localeCompare(
      String(b.unit || '')
    );
  });
}

function getCircularOffsetLatLng(
  anchorLat,
  anchorLon,
  index,
  total
) {
  if (total <= 1) {
    return [anchorLat, anchorLon];
  }

  const baseLatSpacing = 0.00085;
  const baseLonSpacing = 0.00120;
  const radius =
    total <= 3
      ? 0.85
      : total <= 5
        ? 1.0
        : 1.15;

  const angleOffset = -Math.PI / 2;
  const angle =
    angleOffset +
    (2 * Math.PI * index) / total;

  return [
    anchorLat +
      Math.sin(angle) *
        baseLatSpacing *
        radius,
    anchorLon +
      Math.cos(angle) *
        baseLonSpacing *
        radius
  ];
}

function clearMarkers() {
  Object.values(markers).forEach(marker => {
    map.removeLayer(marker);
  });

  markers = {};
}

function setText(id, value) {
  const el = document.getElementById(id);

  if (el) {
    el.innerText = value;
  }
}

function extractFNumber(rawName, apparatusNumber) {
  if (apparatusNumber) {
    return String(apparatusNumber).toUpperCase();
  }

  const match = String(rawName || '').match(/F\d+/i);

  return match ? match[0].toUpperCase() : '';
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function renderDashboard(locations) {
  clearMarkers();

  const unitList =
    document.getElementById('apparatusList');

  unitList.innerHTML = '';

  const searchInput =
    document.getElementById('search');

  const searchText = String(
    searchInput ? searchInput.value : ''
  ).toLowerCase();

  const order = {
    responding: 1,
    moving: 2,
    away: 3,
    stale: 4,
    defined: 5,
    offline: 6,
    nogps: 7
  };

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

      return haystack.includes(searchText);
    })
    .sort((a, b) => {
      const statusDifference =
        order[getStatus(a)] -
        order[getStatus(b)];

      if (statusDifference !== 0) {
        return statusDifference;
      }

      return String(a.unit || '').localeCompare(
        String(b.unit || '')
      );
    });

  const groups = buildGroups(filtered);

  let responding = 0;
  let moving = 0;
  let located = 0;
  let stale = 0;
  let away = 0;
  let gps = 0;
  let noGps = 0;

  const bounds = [];

  Object.keys(groups).forEach(key => {
    const originalGroup = groups[key];
    const layoutGroup =
      sortGroupForLayout(originalGroup);

    const [anchorLat, anchorLon] =
      getGroupAnchor(originalGroup);

    layoutGroup.forEach((v, index) => {
      const status = getStatus(v);

      const [displayLat, displayLon] =
        getCircularOffsetLatLng(
          anchorLat,
          anchorLon,
          index,
          layoutGroup.length
        );

      if (status === 'responding') responding++;
      if (status === 'moving') moving++;
      if (status === 'away') away++;

      if (
        [
          'defined',
          'nogps',
          'offline'
        ].includes(status)
      ) {
        located++;
      }

      if (status === 'stale') stale++;

      const gpsStatus = String(
        v.gpsStatus || ''
      ).toLowerCase();

      if (gpsStatus === 'gps') gps++;
      if (gpsStatus === 'no gps') noGps++;

      const marker = L.marker(
        [displayLat, displayLon],
        {
          icon: markerIcon(v, status),
          zIndexOffset: markerZIndex(
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
        <strong>${escapeHtml(v.unit)}</strong><br><br>
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
        v.rawName + '-' + v.unit
      ] = marker;

      bounds.push([
        displayLat,
        displayLon
      ]);
    });
  });

  filtered.forEach(v => {
    const status = getStatus(v);

    const div =
      document.createElement('div');

    div.className =
      `unit ${status}`;

    const fNumber = extractFNumber(
      v.rawName,
      v.apparatusNumber
    );

    div.innerHTML = `
      <div class="unit-main">
        <div class="unit-title">${escapeHtml(
          String(v.unit || '').toUpperCase()
        )}</div>
        <div class="unit-sub">
          ${escapeHtml(
            v.facility ||
            v.homeStation ||
            'Unknown'
          )}
          ${
            fNumber
              ? ' - ' + escapeHtml(fNumber)
              : ''
          }
        </div>
      </div>
      <span class="badge ${status}">
        ${escapeHtml(statusText(status, v))}
      </span>
    `;

    div.onclick = () => {
      const marker =
        markers[v.rawName + '-' + v.unit];

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
    responding
  );

  setText(
    'locatedCount',
    located
  );

  setText(
    'movingCount',
    moving
  );

  setText(
    'awayCount',
    away
  );

  setText(
    'staleCount',
    stale
  );

  setText(
    'gpsCount',
    gps
  );

  setText(
    'noGpsCount',
    noGps
  );

  const refresh =
    document.getElementById('lastRefresh');

  if (refresh) {
    refresh.innerText =
      'Last refreshed: ' +
      new Date().toLocaleTimeString();
  }

  if (bounds.length > 0) {
    map.fitBounds(bounds, {
      padding: [65, 65]
    });
  }
}

function forceSync() {
  const refresh =
    document.getElementById('lastRefresh');

  if (refresh) {
    refresh.innerText = 'Syncing...';
  }

  const forceButton =
    document.getElementById('forceSync');

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

      renderDashboard(allLocations);
    })
    .catch(error => {
      const refresh =
        document.getElementById('lastRefresh');

      if (refresh) {
        refresh.innerText =
          'Error: ' +
          error.message;
      }
    });
}

const searchInput =
  document.getElementById('search');

if (searchInput) {
  searchInput.addEventListener(
    'input',
    () => {
      renderDashboard(allLocations);
    }
  );
}

const forceButton =
  document.getElementById('forceSync');

if (forceButton) {
  forceButton.addEventListener(
    'click',
    forceSync
  );
}

loadDashboard();
setInterval(loadDashboard, 30000);
