(() => {
  'use strict';

  const STORAGE_KEY = 'wtfd-incident-command-v1';
  const POLL_MS = 5000;
  const MODES = {
    investigation: ['Command', 'Investigation'],
    initial: ['Command', 'Fire Attack', 'Search', 'Water Supply', 'Ventilation', 'RIT', 'Medical'],
    working_fire: ['Command', 'Fire Attack', 'Search', 'Water Supply', 'Ventilation', 'RIT', 'Medical', 'Division / Group', 'Exposure'],
    rescue: ['Command', 'Rescue Group', 'Fire / Hazard Control', 'Medical', 'Extrication', 'Landing Zone'],
    hazmat: ['Command', 'Hazmat Group', 'Entry', 'Backup', 'Decon', 'Medical', 'Safety']
  };

  const state = {
    incident: null,
    latestAlert: null,
    pendingAlert: null,
    selectedUnit: '',
    pollInFlight: false
  };

  const $ = id => document.getElementById(id);

  function nowIso() {
    return new Date().toISOString();
  }

  function parseTimestamp(value) {
    if (value === null || value === undefined || value === '') return null;
    if (typeof value === 'number' || /^\d+(?:\.\d+)?$/.test(String(value).trim())) {
      const number = Number(value);
      return Number.isFinite(number) ? (number < 1e12 ? number * 1000 : number) : null;
    }
    const text = String(value).trim();
    const unzoned = text.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?(?:\.(\d{1,3}))?$/);
    if (unzoned) {
      const [, year, month, day, hour, minute, second = '0', fraction = '0'] = unzoned;
      return Date.UTC(+year, +month - 1, +day, +hour, +minute, +second, +fraction.padEnd(3, '0'));
    }
    const parsed = new Date(text).getTime();
    return Number.isFinite(parsed) ? parsed : null;
  }

  function incidentKey(alert) {
    if (alert?.cadCode) return String(alert.cadCode).trim();
    if (alert?.id) return String(alert.id).trim();
    return [alert?.address, alert?.unit, alert?.city].filter(Boolean).join('|').toLowerCase();
  }

  function cleanUnit(value) {
    return String(value || '')
      .trim()
      .replace(/\s*-\s*/g, '')
      .replace(/\s+/g, ' ')
      .replace(/^ENGINE\s*/i, 'E')
      .replace(/^MEDIC\s*/i, 'M')
      .replace(/^LADDER\s*/i, 'L')
      .replace(/^BATTALION\s*/i, 'B')
      .replace(/^CHIEF\s*/i, 'C')
      .toUpperCase();
  }

  function parseUnits(value) {
    const text = String(value || '').toUpperCase();
    const matches = text.match(/\b(?:ENGINE|MEDIC|LADDER|BATTALION|CHIEF|RESCUE|SQUAD|SAFETY|TRAINING|PREVENTION|MARSHAL|UTILITY|UTV|E|M|L|B|C|R|SQ|T|S|P|U)\s*-?\s*\d{1,3}\b/g) || [];
    const source = matches.length ? matches : text.split(/[,;|/]+/);
    return [...new Set(source.map(cleanUnit).filter(unit => /^[A-Z][A-Z ]*\d{1,3}$/.test(unit)))];
  }

  function modeForAlert(alert) {
    const description = String(alert?.description || '').toUpperCase();
    const details = String(alert?.details || '').toUpperCase();
    const combined = `${description} ${details}`;
    if (/WORKING\s+FIRE|WORKF|WFIRE/.test(combined)) return 'working_fire';
    if (/HAZMT|HAZMAT|GAS|CHEMICAL/.test(combined)) return 'hazmat';
    if (/RESCUE|VEHACC|EXTRICAT|ELEVATOR|WATER RESCUE/.test(combined)) return 'rescue';
    if (/FIRE|FALARM|STRUCTURE|SMOKE/.test(combined)) return 'initial';
    return 'investigation';
  }

  function extractLinks(alert) {
    const text = [alert?.details, alert?.place].filter(Boolean).join(' ');
    const matches = text.match(/https?:\/\/[^\s<>()]+/gi) || [];
    return [...new Set(matches.map(link => link.replace(/[.,;]+$/, '')))];
  }

  function assignmentId(name) {
    return `assignment-${String(name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}-${Math.random().toString(36).slice(2, 7)}`;
  }

  function logEntry(message, type = 'action') {
    if (!state.incident) return;
    state.incident.log.unshift({ at: nowIso(), message, type });
    persist();
  }

  function createIncident(alert, source = 'Active911') {
    const receivedMs = parseTimestamp(alert?.received) || Date.now();
    const mode = modeForAlert(alert);
    const units = parseUnits(alert?.units);
    const assignments = MODES[mode].map(name => ({ id: assignmentId(name), name, units: [] }));
    state.incident = {
      key: incidentKey(alert) || `manual-${Date.now()}`,
      source,
      active911Id: String(alert?.id || ''),
      cadCode: String(alert?.cadCode || ''),
      description: String(alert?.description || 'Emergency Call'),
      place: String(alert?.place || ''),
      address: String(alert?.address || ''),
      unit: String(alert?.unit || ''),
      city: String(alert?.city || ''),
      state: String(alert?.state || ''),
      crossStreet: String(alert?.crossStreet || ''),
      details: String(alert?.details || ''),
      dispatchedUnitsRaw: String(alert?.units || ''),
      priority: String(alert?.priority || ''),
      received: alert?.received || new Date(receivedMs).toISOString(),
      startedAt: new Date(receivedMs).toISOString(),
      commandStartedAt: nowIso(),
      mode,
      units: units.map(name => ({ name, assignmentId: 'bank', source: 'Active911', addedAt: nowIso() })),
      assignments,
      occupancy: '',
      floors: '',
      basement: 'unknown',
      links: extractLinks(alert),
      log: [{ at: nowIso(), message: `${source} incident opened in command board`, type: 'system' }]
    };
    state.pendingAlert = null;
    state.selectedUnit = '';
    persist();
    render();
  }

  function mergeAlert(alert) {
    const incident = state.incident;
    if (!incident) return;
    const changed = [];
    const mappings = [
      ['description', 'description', 'Incident type'],
      ['place', 'place', 'Place'],
      ['address', 'address', 'Address'],
      ['unit', 'unit', 'Address unit'],
      ['city', 'city', 'City'],
      ['state', 'state', 'State'],
      ['crossStreet', 'crossStreet', 'Cross street'],
      ['details', 'details', 'Narrative'],
      ['priority', 'priority', 'Priority'],
      ['units', 'dispatchedUnitsRaw', 'Dispatched units']
    ];

    mappings.forEach(([sourceKey, targetKey, label]) => {
      const next = String(alert?.[sourceKey] || '');
      if (next && next !== String(incident[targetKey] || '')) {
        incident[targetKey] = next;
        changed.push(label);
      }
    });

    const existing = new Set(incident.units.map(unit => unit.name));
    const added = parseUnits(alert?.units).filter(unit => !existing.has(unit));
    added.forEach(name => incident.units.push({ name, assignmentId: 'bank', source: 'Active911', addedAt: nowIso() }));
    if (added.length) changed.push(`Added units: ${added.join(', ')}`);

    incident.links = [...new Set([...incident.links, ...extractLinks(alert)])];
    const nextMode = modeForAlert(alert);
    if (nextMode === 'working_fire' && incident.mode !== 'working_fire') {
      applyMode('working_fire', false);
      changed.push('Mode changed to Working Fire');
    }

    if (changed.length) {
      incident.log.unshift({ at: nowIso(), message: `Active911 update — ${changed.join('; ')}`, type: 'update' });
      persist();
      render();
    }
  }

  function persist() {
    try {
      if (state.incident) localStorage.setItem(STORAGE_KEY, JSON.stringify(state.incident));
      else localStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      console.warn('Unable to save incident board state', error);
    }
  }

  function restore() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
      if (parsed?.key && Array.isArray(parsed.units) && Array.isArray(parsed.assignments)) {
        state.incident = parsed;
      }
    } catch (error) {
      console.warn('Unable to restore incident board state', error);
    }
  }

  function formatClock(value, includeDate = false) {
    const parsed = parseTimestamp(value);
    const date = new Date(Number.isFinite(parsed) ? parsed : value);
    if (Number.isNaN(date.getTime())) return '';
    const options = includeDate
      ? { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York' }
      : { hour: 'numeric', minute: '2-digit', second: '2-digit', timeZone: 'America/New_York' };
    return date.toLocaleString([], options);
  }

  function elapsedText(startedAt) {
    const start = parseTimestamp(startedAt) || Date.now();
    const seconds = Math.max(0, Math.floor((Date.now() - start) / 1000));
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainder = seconds % 60;
    return hours
      ? `${hours}:${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')} elapsed`
      : `${minutes}:${String(remainder).padStart(2, '0')} elapsed`;
  }

  function unitClass(name) {
    if (/^(E|L|R|SQ)/.test(name)) return 'fire';
    if (/^M/.test(name)) return 'medic';
    if (/^(B|C|CHIEF|SAFETY|TRAINING)/.test(name)) return 'command';
    return '';
  }

  function unitChip(unit) {
    const selected = state.selectedUnit === unit.name ? ' selected' : '';
    return `<button class="unit-chip ${unitClass(unit.name)}${selected}" type="button" draggable="true" data-unit="${escapeHtml(unit.name)}" aria-pressed="${Boolean(selected)}">${escapeHtml(unit.name)}</button>`;
  }

  function renderAssignments() {
    const incident = state.incident;
    const board = $('assignmentBoard');
    if (!incident || !board) return;
    board.innerHTML = incident.assignments.map(assignment => {
      const units = incident.units.filter(unit => unit.assignmentId === assignment.id);
      const removable = !/^Command$/i.test(assignment.name);
      return `<section class="assignment-card drop-zone" data-assignment-id="${escapeHtml(assignment.id)}">
        <header data-target-assignment="${escapeHtml(assignment.id)}">
          <h3>${escapeHtml(assignment.name)}</h3>
          ${removable ? `<button type="button" data-remove-assignment="${escapeHtml(assignment.id)}" aria-label="Remove ${escapeHtml(assignment.name)}">×</button>` : ''}
        </header>
        <div class="assignment-units" data-target-assignment="${escapeHtml(assignment.id)}">${units.map(unitChip).join('')}</div>
      </section>`;
    }).join('');

    const bank = incident.units.filter(unit => unit.assignmentId === 'bank');
    $('apparatusBank').innerHTML = bank.map(unitChip).join('');
    $('bankCount').textContent = String(bank.length);
    bindAssignmentInteractions();
  }

  function renderLog() {
    const log = $('commandLog');
    if (!state.incident || !log) return;
    log.innerHTML = state.incident.log.map(entry => `<li><time>${escapeHtml(formatClock(entry.at))}</time><span>${escapeHtml(entry.message)}</span></li>`).join('');
  }

  function renderDetails() {
    const incident = state.incident;
    if (!incident) return;
    const pairs = [
      ['Call type', incident.description],
      ['Address', [incident.address, incident.unit, incident.city, incident.state].filter(Boolean).join(' ')],
      ['Cross street', incident.crossStreet],
      ['CAD number', incident.cadCode],
      ['Dispatched units', incident.dispatchedUnitsRaw],
      ['Priority', incident.priority],
      ['Narrative', incident.details]
    ].filter(([, value]) => String(value || '').trim());
    $('incidentDetails').innerHTML = pairs.map(([label, value]) => `<dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd>`).join('');
  }

  function render() {
    const active = Boolean(state.incident);
    $('emptyState').hidden = active;
    $('incidentWorkspace').hidden = !active;

    if (!active) {
      const alert = state.latestAlert;
      $('startLatestButton').disabled = !alert;
      $('latestAlertSummary').textContent = alert
        ? `${alert.description || 'Emergency Call'} • ${[alert.address, alert.unit, alert.city].filter(Boolean).join(' ') || 'Location unavailable'}`
        : 'Waiting for the latest Active911 dispatch…';
      return;
    }

    const incident = state.incident;
    $('incidentType').textContent = incident.description || 'Emergency Call';
    $('incidentLocation').textContent = [incident.place, incident.address, incident.unit, incident.city].filter(Boolean).join(' • ') || 'Location unavailable';
    $('incidentNumber').textContent = incident.cadCode ? `Incident ${incident.cadCode}` : 'Manual incident';
    $('incidentReceived').textContent = `Received ${formatClock(incident.received, true)}`;
    $('incidentElapsed').textContent = elapsedText(incident.startedAt);
    $('occupancyInput').value = incident.occupancy || '';
    $('floorsInput').value = incident.floors || '';
    $('basementInput').value = incident.basement || 'unknown';

    document.querySelectorAll('#modeButtons button').forEach(button => {
      button.classList.toggle('active', button.dataset.mode === incident.mode);
    });

    $('preplanLinks').innerHTML = incident.links.map((link, index) => `<a href="${escapeHtml(link)}" target="_blank" rel="noopener noreferrer">Open Active911 / Preplan Link ${index + 1}</a>`).join('');
    renderAssignments();
    renderLog();
    renderDetails();
  }

  function applyMode(mode, addLog = true) {
    const incident = state.incident;
    if (!incident || !MODES[mode] || mode === incident.mode) return;
    const existingNames = new Set(incident.assignments.map(assignment => assignment.name.toLowerCase()));
    MODES[mode].forEach(name => {
      if (!existingNames.has(name.toLowerCase())) incident.assignments.push({ id: assignmentId(name), name, units: [] });
    });
    incident.mode = mode;
    if (addLog) logEntry(`Incident mode changed to ${modeLabel(mode)}`);
    else persist();
    render();
  }

  function modeLabel(mode) {
    return ({ investigation: 'Investigation', initial: 'Initial Operations', working_fire: 'Working Fire', rescue: 'Rescue', hazmat: 'Hazmat' })[mode] || mode;
  }

  function moveUnit(unitName, assignmentId) {
    const unit = state.incident?.units.find(item => item.name === unitName);
    if (!unit || unit.assignmentId === assignmentId) {
      state.selectedUnit = '';
      renderAssignments();
      return;
    }
    const previous = unit.assignmentId === 'bank'
      ? 'Apparatus Bank'
      : state.incident.assignments.find(item => item.id === unit.assignmentId)?.name || 'Unassigned';
    const next = assignmentId === 'bank'
      ? 'Apparatus Bank'
      : state.incident.assignments.find(item => item.id === assignmentId)?.name;
    if (!next) return;
    unit.assignmentId = assignmentId;
    state.selectedUnit = '';
    logEntry(`${unit.name} moved from ${previous} to ${next}`);
    render();
  }

  function bindAssignmentInteractions() {
    document.querySelectorAll('.unit-chip').forEach(chip => {
      chip.addEventListener('click', event => {
        event.stopPropagation();
        state.selectedUnit = state.selectedUnit === chip.dataset.unit ? '' : chip.dataset.unit;
        renderAssignments();
      });
      chip.addEventListener('dragstart', event => {
        event.dataTransfer.setData('text/plain', chip.dataset.unit);
        event.dataTransfer.effectAllowed = 'move';
      });
    });

    document.querySelectorAll('.drop-zone').forEach(zone => {
      zone.addEventListener('dragover', event => { event.preventDefault(); zone.classList.add('drag-over'); });
      zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
      zone.addEventListener('drop', event => {
        event.preventDefault();
        zone.classList.remove('drag-over');
        moveUnit(event.dataTransfer.getData('text/plain'), zone.dataset.assignmentId);
      });
    });

    document.querySelectorAll('[data-target-assignment]').forEach(target => {
      target.addEventListener('click', event => {
        if (event.target.closest('[data-remove-assignment]')) return;
        if (state.selectedUnit) moveUnit(state.selectedUnit, target.dataset.targetAssignment);
      });
    });

    document.querySelectorAll('[data-remove-assignment]').forEach(button => {
      button.addEventListener('click', event => {
        event.stopPropagation();
        const assignment = state.incident.assignments.find(item => item.id === button.dataset.removeAssignment);
        if (!assignment) return;
        state.incident.units.filter(unit => unit.assignmentId === assignment.id).forEach(unit => { unit.assignmentId = 'bank'; });
        state.incident.assignments = state.incident.assignments.filter(item => item.id !== assignment.id);
        logEntry(`${assignment.name} assignment removed; its units returned to the bank`);
        render();
      });
    });
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>'"]/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character]);
  }

  function showPendingAlert(alert) {
    state.pendingAlert = alert;
    $('newDispatchSummary').textContent = `${alert.description || 'Emergency Call'} • ${[alert.address, alert.unit, alert.city].filter(Boolean).join(' ') || 'Location unavailable'}`;
    $('newDispatchBanner').hidden = false;
  }

  function hidePendingAlert() {
    $('newDispatchBanner').hidden = true;
  }

  async function pollActive911() {
    if (state.pollInFlight || document.visibilityState === 'hidden') return;
    state.pollInFlight = true;
    try {
      const response = await fetch('/api/active911', { cache: 'no-store' });
      if (!response.ok) throw new Error(`Active911 request failed (${response.status})`);
      const data = await response.json();
      const alert = data.alert;
      $('feedStatus').textContent = '● ACTIVE911 CONNECTED';
      $('feedStatus').className = 'feed-status online';
      if (!alert?.id) return;
      state.latestAlert = alert;
      if (!state.incident) {
        render();
      } else if (incidentKey(alert) === state.incident.key) {
        mergeAlert(alert);
      } else if (incidentKey(alert) !== incidentKey(state.pendingAlert)) {
        showPendingAlert(alert);
      }
    } catch (error) {
      $('feedStatus').textContent = '● ACTIVE911 CONNECTION LOST';
      $('feedStatus').className = 'feed-status offline';
      console.warn(error);
    } finally {
      state.pollInFlight = false;
    }
  }

  function exportLog() {
    const incident = state.incident;
    if (!incident) return;
    const rows = [
      ['WTFD Incident Command Log'],
      ['Incident', incident.cadCode || incident.key],
      ['Call Type', incident.description],
      ['Location', [incident.address, incident.unit, incident.city, incident.state].filter(Boolean).join(' ')],
      ['Received', incident.received],
      ['Command Started', incident.commandStartedAt],
      ['Mode', modeLabel(incident.mode)],
      ['Occupancy', incident.occupancy],
      ['Floors', incident.floors],
      ['Basement', incident.basement],
      [],
      ['Time', 'Event']
    ];
    [...incident.log].reverse().forEach(entry => rows.push([entry.at, entry.message]));
    rows.push([], ['Final Unit Assignments']);
    incident.assignments.forEach(assignment => {
      rows.push([assignment.name, incident.units.filter(unit => unit.assignmentId === assignment.id).map(unit => unit.name).join(', ')]);
    });
    rows.push(['Apparatus Bank', incident.units.filter(unit => unit.assignmentId === 'bank').map(unit => unit.name).join(', ')]);

    const csv = rows.map(row => row.map(value => `"${String(value ?? '').replace(/"/g, '""')}"`).join(',')).join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `WTFD-Command-${(incident.cadCode || Date.now()).replace(/[^a-z0-9-]/gi, '_')}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(link.href);
    logEntry('Command log exported');
  }

  function bindEvents() {
    $('startLatestButton').addEventListener('click', () => state.latestAlert && createIncident(state.latestAlert));
    $('startManualButton').addEventListener('click', () => $('manualIncidentDialog').showModal());
    $('manualIncidentForm').addEventListener('submit', event => {
      if (event.submitter?.value === 'cancel') return;
      event.preventDefault();
      const values = Object.fromEntries(new FormData(event.currentTarget));
      createIncident({ ...values, id: `manual-${Date.now()}`, received: nowIso(), units: '' }, 'Manual');
      $('manualIncidentDialog').close();
      event.currentTarget.reset();
    });

    $('modeButtons').addEventListener('click', event => {
      const button = event.target.closest('[data-mode]');
      if (button) applyMode(button.dataset.mode);
    });

    $('addUnitForm').addEventListener('submit', event => {
      event.preventDefault();
      const name = cleanUnit($('addUnitInput').value);
      if (!name || state.incident.units.some(unit => unit.name === name)) return;
      state.incident.units.push({ name, assignmentId: 'bank', source: 'Manual', addedAt: nowIso() });
      $('addUnitInput').value = '';
      logEntry(`${name} added manually to apparatus bank`);
      render();
    });

    $('addAssignmentButton').addEventListener('click', () => $('addAssignmentDialog').showModal());
    $('addAssignmentForm').addEventListener('submit', event => {
      if (event.submitter?.value === 'cancel') return;
      event.preventDefault();
      const name = String(new FormData(event.currentTarget).get('name') || '').trim();
      if (name && !state.incident.assignments.some(item => item.name.toLowerCase() === name.toLowerCase())) {
        state.incident.assignments.push({ id: assignmentId(name), name, units: [] });
        logEntry(`${name} assignment added`);
        render();
      }
      $('addAssignmentDialog').close();
      event.currentTarget.reset();
    });

    $('logForm').addEventListener('submit', event => {
      event.preventDefault();
      const message = $('logInput').value.trim();
      if (!message) return;
      $('logInput').value = '';
      logEntry(message, 'note');
      renderLog();
    });

    ['occupancyInput', 'floorsInput', 'basementInput'].forEach(id => {
      $(id).addEventListener('change', () => {
        const property = ({ occupancyInput: 'occupancy', floorsInput: 'floors', basementInput: 'basement' })[id];
        state.incident[property] = $(id).value;
        logEntry(`${property[0].toUpperCase()}${property.slice(1)} set to ${$(id).value || 'blank'}`);
      });
    });

    $('detailsButton').addEventListener('click', () => { renderDetails(); $('detailsDialog').showModal(); });
    $('closeDetailsButton').addEventListener('click', () => $('detailsDialog').close());
    $('printButton').addEventListener('click', () => window.print());
    $('exportButton').addEventListener('click', exportLog);
    $('clearIncidentButton').addEventListener('click', () => $('endIncidentDialog').showModal());
    $('confirmEndIncident').addEventListener('click', () => {
      state.incident = null;
      state.selectedUnit = '';
      persist();
      hidePendingAlert();
      render();
    });

    $('dismissDispatchButton').addEventListener('click', hidePendingAlert);
    $('viewDispatchButton').addEventListener('click', () => {
      const alert = state.pendingAlert;
      if (!alert) return;
      $('newDispatchDetails').innerHTML = `<h3>${escapeHtml(alert.description || 'Emergency Call')}</h3><p>${escapeHtml([alert.address, alert.unit, alert.city].filter(Boolean).join(' '))}</p><p><strong>Units:</strong> ${escapeHtml(alert.units || 'Not listed')}</p><p>${escapeHtml(alert.details || '')}</p>`;
      $('newDispatchDialog').showModal();
    });
    $('closeDispatchDialog').addEventListener('click', () => $('newDispatchDialog').close());
    $('fullscreenButton').addEventListener('click', async () => {
      try {
        if (document.fullscreenElement) await document.exitFullscreen();
        else await document.documentElement.requestFullscreen();
      } catch (error) { console.warn(error); }
    });
  }

  function tick() {
    $('commandClock').textContent = formatClock(Date.now());
    if (state.incident) $('incidentElapsed').textContent = elapsedText(state.incident.startedAt);
  }

  restore();
  bindEvents();
  render();
  tick();
  pollActive911();
  setInterval(tick, 1000);
  setInterval(pollActive911, POLL_MS);
  window.addEventListener('online', pollActive911);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') pollActive911();
  });

  window.WTFD_COMMAND_TEST = {
    parseUnits,
    incidentKey,
    modeForAlert,
    extractLinks,
    parseTimestamp,
    formatClock
  };
})();
