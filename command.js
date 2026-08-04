(() => {
  'use strict';

  const STORAGE_KEY = 'wtfd-incident-command-v2';
  const LEGACY_STORAGE_KEY = 'wtfd-incident-command-v1';
  const LAST_CLOSED_KEY = 'wtfd-last-closed-command-v2';
  const POLL_MS = 5000;
  const PAGE_SIZES = { position: 4, assignment: 9, bank: 9, benchmark: 4 };

  const POLICY_STATUS = {
    required: 'Required',
    conditional: 'Conditional',
    advisory: 'Advisory',
    optional: 'Optional',
    derived: 'Command Created'
  };

  const STRATEGY_LABELS = {
    investigation: 'Investigation',
    offensive: 'Offensive',
    defensive: 'Defensive',
    transitional: 'Transitional'
  };

  const LEVEL_LABELS = {
    initial: 'Initial',
    working_fire: 'Working Fire',
    additional_alarm: 'Additional Alarm'
  };

  const UNIVERSAL_BENCHMARKS = [
    benchmark('command_established', 'Command established', 'required', '201; 702'),
    benchmark('initial_sizeup', 'Initial size-up complete', 'required', '201; 702'),
    benchmark('objectives_established', 'Objectives established', 'required', '201; 208'),
    benchmark('primary_channel', 'Primary channel established', 'required', '204; 713'),
    benchmark('accountability_active', 'Accountability active', 'required', '201; 203; 703'),
    benchmark('hazards_communicated', 'Hazards communicated', 'conditional', '204; 205'),
    benchmark('progress_report', 'CAN / progress report', 'advisory', '713')
  ];

  const TECHNICAL_COMMON_BENCHMARKS = [
    benchmark('hazard_assessment', 'Hazard assessment complete', 'required', '1001'),
    benchmark('capability_evaluated', 'Operational capability evaluated', 'required', '1001'),
    benchmark('zones_established', 'Operational zones / access control established', 'required', '1001'),
    benchmark('specialized_resources', 'Specialized-resource need decided', 'required', '1001')
  ];

  const PROFILE_DEFINITIONS = {
    generic: profile('General Incident', ['Operations'], [], [
      benchmark('situation_stabilized', 'Situation stabilized', 'derived', 'Command benchmark')
    ]),
    structure_fire: profile('Structure Fire',
      ['Fire Attack', 'Primary Search', 'Water Supply', 'Ventilation', 'Exposure Protection', 'Utilities', 'Medical', 'Rehabilitation'],
      [position('ric', 'RIC Capability', 'conditional', '704'), position('safety', 'Incident Safety', 'optional', '205')],
      fireBenchmarks()),
    high_rise: profile('High-Rise Fire',
      ['Fire Attack', 'Primary Search', 'Water Supply / Systems', 'Evacuation', 'Rehabilitation'],
      [
        position('ric', 'RIC Capability', 'conditional', '704'),
        position('safety', 'Incident Safety', 'optional', '205'),
        position('base', 'Base', 'conditional', '716'),
        position('lobby-control', 'Lobby Control', 'conditional', '716'),
        position('interior-staging', 'Interior Staging', 'advisory', '716'),
        position('fire-floor-division', 'Fire Floor Division', 'conditional', '716')
      ],
      [
        benchmark('fire_floor_identified', 'Fire floor identified', 'advisory', '716'),
        benchmark('base_established', 'Base established', 'conditional', '716'),
        benchmark('lobby_control_assigned', 'Lobby Control assigned', 'conditional', '716'),
        benchmark('interior_staging', 'Interior Staging identified', 'advisory', '716'),
        benchmark('stairwells_designated', 'Attack / evacuation stairwells designated', 'advisory', '716'),
        benchmark('building_systems', 'Building systems evaluated', 'advisory', '716'),
        ...fireBenchmarks()
      ]),
    commercial_industrial: profile('Commercial / Industrial Fire',
      ['Fire Attack', 'Primary Search', 'Water Supply', 'Exposure Protection', 'Collapse Zone', 'Rehabilitation'],
      [position('ric', 'RIC Capability', 'conditional', '704'), position('safety', 'Incident Safety', 'optional', '205'), position('staging', 'Staging', 'optional', '209')],
      [
        benchmark('divisions_established', 'Operational divisions established', 'conditional', '717'),
        benchmark('collapse_zone', 'Collapse zone considered / established', 'conditional', '717'),
        ...fireBenchmarks()
      ]),
    multifamily: profile('Large Multifamily Fire',
      ['Fire Attack', 'Primary Search', 'Evacuation', 'Exposure Units', 'Water Supply', 'Ventilation', 'Medical'],
      [position('ric', 'RIC Capability', 'conditional', '704'), position('safety', 'Incident Safety', 'optional', '205')],
      [
        benchmark('life_safety_status', 'Life-safety / occupant status communicated', 'advisory', '718'),
        benchmark('exposure_units', 'Exposure units evaluated', 'advisory', '718'),
        ...fireBenchmarks()
      ]),
    basement_fire: profile('Basement / Below-Grade Fire',
      ['Fire Attack', 'Primary Search', 'Water Supply', 'Ventilation', 'Floor Integrity', 'Utilities'],
      [position('ric', 'RIC Capability', 'conditional', '704'), position('safety', 'Incident Safety', 'optional', '205')],
      [
        benchmark('below_grade_confirmed', 'Below-grade fire confirmed', 'advisory', '720'),
        benchmark('access_selected', 'Access point selected', 'advisory', '720'),
        benchmark('floor_integrity', 'Floor integrity evaluated', 'required', '720'),
        benchmark('ventilation_coordinated', 'Ventilation coordinated with attack', 'required', '720'),
        ...fireBenchmarks()
      ]),
    fire_systems: profile('Fire-Protection Systems',
      ['System Investigation', 'FDC Supply', 'Standpipe Operations', 'Fire Pump / Control Room'],
      [position('systems', 'Building Systems', 'derived', '721'), position('water-supply-officer', 'Water Supply Officer', 'optional', '1803')],
      [
        benchmark('sprinkler_status', 'Sprinkler operating status identified', 'advisory', '721'),
        benchmark('fdc_supplied', 'FDC supplied', 'conditional', '721'),
        benchmark('standpipe_established', 'Standpipe operation established', 'conditional', '721'),
        benchmark('system_condition', 'Fire pump / system condition identified', 'advisory', '721')
      ]),
    vehicle_fire: profile('Vehicle Fire',
      ['Traffic Protection', 'Fire Attack', 'Exposure Protection', 'Overhaul / Monitoring'],
      [position('safety', 'Incident Safety', 'optional', '205')],
      [
        benchmark('traffic_protection', 'Traffic protection established', 'conditional', '711'),
        benchmark('energy_hazards', 'Fuel / energy hazards identified', 'required', '711'),
        benchmark('exposures_protected', 'Exposures protected', 'conditional', '711'),
        benchmark('fire_controlled', 'Fire controlled', 'derived', '711'),
        benchmark('extended_monitoring', 'Alternative-fuel monitoring / overhaul complete', 'conditional', '711')
      ]),
    exterior_fire: profile('Exterior Fire',
      ['Fire Control', 'Exposure Protection', 'Water Supply', 'Perimeter / Containment'],
      [position('safety', 'Incident Safety', 'optional', '205')],
      [
        benchmark('spread_assessed', 'Fire spread / perimeter assessed', 'required', '712'),
        benchmark('environment_assessed', 'Wind, terrain, fuels, and weather evaluated', 'required', '712'),
        benchmark('exposures_protected', 'Exposures protected', 'conditional', '712'),
        benchmark('containment', 'Containment / control confirmed', 'derived', '712')
      ]),
    rope_rescue: rescueProfile('Rope Rescue',
      ['Rescue Operations', 'Rigging / Systems', 'Medical'],
      [
        benchmark('anchors_verified', 'Anchors and rescue systems verified', 'required', '1002'),
        benchmark('belay_confirmed', 'Belay / safety system confirmed', 'required', '1002'),
        benchmark('equipment_ready', 'Equipment readiness confirmed', 'required', '1002')
      ]),
    confined_space: rescueProfile('Confined Space Rescue',
      ['Hazard Control', 'Atmospheric Monitoring', 'Entry', 'Backup / Retrieval', 'Medical'],
      [
        benchmark('atmosphere_evaluated', 'Atmosphere evaluated', 'required', '1003'),
        benchmark('entry_controls', 'Entry controls and authorization complete', 'required', '1003'),
        benchmark('ventilation_respiration', 'Ventilation / respiratory protection ready', 'required', '1003'),
        benchmark('entry_communications', 'Entry-team communications established', 'required', '1003'),
        benchmark('backup_retrieval', 'Backup / retrieval capability available', 'required', '1003'),
        benchmark('region3_request', 'Region 3 request decision complete', 'required', '1003')
      ]),
    trench_rescue: rescueProfile('Trench Rescue',
      ['Scene Control', 'Hazard Control', 'Stabilization', 'Rescue Operations', 'Medical'],
      [
        benchmark('collapse_zone', 'Collapse zone established', 'required', '1004'),
        benchmark('entry_restricted', 'Unprotected entry restricted', 'required', '1004'),
        benchmark('trench_stabilized', 'Trench stabilization confirmed', 'required', '1004'),
        benchmark('surface_hazards', 'Machinery, vibration, and spoil hazards controlled', 'required', '1004'),
        benchmark('region3_request', 'Region 3 requested / decision documented', 'required', '1004')
      ]),
    structural_collapse: rescueProfile('Structural Collapse',
      ['Scene Control', 'Hazard Control', 'Search', 'Stabilization / Shoring', 'Medical'],
      [
        benchmark('collapse_zone', 'Collapse zone established', 'required', '1005'),
        benchmark('utilities_isolated', 'Utilities controlled / isolated', 'conditional', '1005'),
        benchmark('secondary_collapse', 'Secondary-collapse hazards evaluated', 'required', '1005'),
        benchmark('rapid_search', 'Accessible rapid search decision complete', 'required', '1005'),
        benchmark('region3_request', 'Region 3 request decision complete', 'required', '1005')
      ]),
    water_ice_rescue: rescueProfile('Water / Ice Rescue',
      ['Shore Operations', 'Rescue Operations', 'Downstream / Backup', 'Medical'],
      [
        benchmark('victim_location', 'Victim location confirmed', 'required', '1006'),
        benchmark('water_conditions', 'Water / ice / weather conditions evaluated', 'required', '1006'),
        benchmark('reach_throw_go', 'Reach–throw–go strategy selected', 'advisory', '1006'),
        benchmark('pfd_thermal', 'PFD / thermal PPE confirmed', 'required', '1006'),
        benchmark('dive_request', 'Dive-team request decision complete', 'conditional', '1006')
      ]),
    disaster_search: rescueProfile('Disaster Search',
      ['Damage Assessment', 'Primary Search', 'Secondary Search', 'Structure Marking'],
      [
        benchmark('search_sectors', 'Geographic search sectors established', 'conditional', '1007'),
        benchmark('damage_assessment', 'Rapid damage assessment complete', 'required', '1007'),
        benchmark('priority_areas', 'Priority search areas identified', 'required', '1007'),
        benchmark('marking_system', 'Structure marking system established', 'conditional', '1007'),
        benchmark('usar_coordination', 'USAR / EMA coordination decision complete', 'conditional', '1007')
      ]),
    lost_person: rescueProfile('Lost Person Search',
      ['Search Planning', 'Search Sector', 'Medical / Support'],
      [
        benchmark('lead_agency', 'Lead investigative agency identified', 'required', '1008'),
        benchmark('search_area', 'Search area / sectors established', 'required', '1008'),
        benchmark('team_communications', 'Search-team communications confirmed', 'required', '1008'),
        benchmark('special_resources', 'Specialized-resource need decided', 'conditional', '1008'),
        benchmark('rest_relief', 'Rest / relief plan established', 'conditional', '1008')
      ]),
    vehicle_machinery_rescue: rescueProfile('Vehicle / Machinery Rescue',
      ['Scene Protection', 'Stabilization', 'Hazard Control', 'Extrication', 'Medical'],
      [
        benchmark('equipment_stabilized', 'Vehicle / equipment stabilized', 'required', '1009'),
        benchmark('energy_controlled', 'Mechanical / electrical / stored energy controlled', 'required', '1009'),
        benchmark('victim_access', 'Victim access established', 'derived', '1009'),
        benchmark('ems_coordinated', 'EMS coordination confirmed', 'required', '1009')
      ]),
    elevator_rescue: rescueProfile('Elevator Rescue',
      ['Occupant Contact', 'Elevator Control', 'Rescue Operations', 'Medical'],
      [
        benchmark('occupant_contact', 'Occupant contact / medical status established', 'required', '1010'),
        benchmark('car_location', 'Elevator car location verified', 'required', '1010'),
        benchmark('power_controlled', 'Power / control secured', 'conditional', '1010'),
        benchmark('car_stable', 'Elevator car stability confirmed', 'required', '1010'),
        benchmark('occupants_removed', 'Occupants safely removed', 'derived', '1010')
      ]),
    hazmat_generic: profile('Hazmat — Generic', ['Hazard Control', 'Operations', 'Medical'], [position('safety', 'Incident Safety', 'optional', '205')], [
      benchmark('policy_gap_hazmat', 'Hazmat policy-specific benchmarks unavailable', 'optional', 'Policy gap')
    ])
  };

  const CORE_POSITIONS = [
    position('incident-command', 'Incident Command', 'required', '201; 702', false),
    position('accountability', 'Accountability Function', 'required', '201; 203; 703', false)
  ];

  const state = {
    incident: null,
    latestAlert: null,
    pendingAlert: null,
    selectedUnit: '',
    pollInFlight: false,
    pages: { position: 0, assignment: 0, bank: 0, benchmark: 0 },
    pendingRemoval: null
  };

  const $ = id => document.getElementById(id);

  function benchmark(id, label, policyStatus, source) {
    return { id, label, policyStatus, source };
  }

  function position(key, name, policyStatus, source, removable = true) {
    return { key, name, policyStatus, source, removable };
  }

  function profile(label, tasks, positions, benchmarks) {
    return { label, tasks, positions, benchmarks, technicalRescue: false, fireProfile: false };
  }

  function rescueProfile(label, tasks, benchmarks) {
    return {
      label,
      tasks,
      positions: [position('rescue-group', 'Rescue Group', 'derived', '1001'), position('safety', 'Incident Safety', 'optional', '205')],
      benchmarks: [...TECHNICAL_COMMON_BENCHMARKS, ...benchmarks],
      technicalRescue: true,
      fireProfile: false
    };
  }

  function fireBenchmarks() {
    return [
      benchmark('fire_location', 'Fire location identified', 'advisory', '716–718; 720'),
      benchmark('water_supply', 'Water supply established', 'conditional', '707; 1803'),
      benchmark('attack_line', 'Attack line in service', 'advisory', '716; 720'),
      benchmark('primary_search', 'Primary search status reported', 'advisory', '705; 716; 718'),
      benchmark('fire_under_control', 'Fire under control', 'advisory', '716–718; 720'),
      benchmark('situation_stabilized', 'Situation stabilized', 'advisory', '716–718; 720')
    ];
  }

  Object.values(PROFILE_DEFINITIONS).forEach(definition => {
    if (/Fire|High-Rise|Multifamily|Basement|Systems/.test(definition.label) && !definition.technicalRescue) {
      definition.fireProfile = !['Vehicle Fire', 'Exterior Fire'].includes(definition.label);
    }
  });

  function nowIso() {
    return new Date().toISOString();
  }

  function slug(value) {
    return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  }

  function uniqueId(prefix, value) {
    return `${prefix}-${slug(value)}-${Math.random().toString(36).slice(2, 7)}`;
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

  function inferProfile(alert) {
    const text = `${alert?.description || ''} ${alert?.details || ''}`.toUpperCase();
    if (/ELEVATOR|LIFT\s*(?:CAR|SHAFT).*ENTRAP|STUCK\s+(?:IN|ON)\s+(?:AN?\s+)?ELEVATOR/.test(text)) return 'elevator_rescue';
    if (/CONFINED\s*SPACE/.test(text)) return 'confined_space';
    if (/TRENCH|EXCAVATION/.test(text)) return 'trench_rescue';
    if (/STRUCTURAL\s+COLLAPSE|BUILDING\s+COLLAPSE/.test(text)) return 'structural_collapse';
    if (/WATER\s+RESCUE|ICE\s+RESCUE|DROWNING|SUBMERGED/.test(text)) return 'water_ice_rescue';
    if (/ROPE\s+RESCUE|HIGH[- ]ANGLE|LOW[- ]ANGLE/.test(text)) return 'rope_rescue';
    if (/LOST\s+PERSON|MISSING\s+PERSON/.test(text)) return 'lost_person';
    if (/ENTRAP|EXTRICAT|VEHACC|MACHINERY/.test(text)) return 'vehicle_machinery_rescue';
    if (/HIGH[- ]RISE/.test(text)) return 'high_rise';
    if (/BASEMENT|BELOW[- ]GRADE/.test(text)) return 'basement_fire';
    if (/COMMERCIAL|INDUSTRIAL|WAREHOUSE/.test(text) && /FIRE|FALARM/.test(text)) return 'commercial_industrial';
    if (/APARTMENT|MULTIFAMILY|MULTI-FAMILY/.test(text) && /FIRE|FALARM/.test(text)) return 'multifamily';
    if (/VEHICLE\s+FIRE|CAR\s+FIRE/.test(text)) return 'vehicle_fire';
    if (/BRUSH|GRASS|RUBBISH|OUTSIDE\s+FIRE|EXTERIOR\s+FIRE/.test(text)) return 'exterior_fire';
    if (/HAZMT|HAZMAT|CHEMICAL/.test(text)) return 'hazmat_generic';
    if (/FIRE|FALARM|STRUCTURE|SMOKE/.test(text)) return 'structure_fire';
    return 'generic';
  }

  function detectOperationalLevel(alert) {
    const text = `${alert?.description || ''} ${alert?.details || ''}`.toUpperCase();
    if (/ADDITIONAL\s+ALARM|SECOND\s+ALARM|2ND\s+ALARM|THIRD\s+ALARM|3RD\s+ALARM/.test(text)) return 'additional_alarm';
    if (/WORKING\s+FIRE|WORKF|WFIRE/.test(text)) return 'working_fire';
    return 'initial';
  }

  function extractLinks(alert) {
    const text = [alert?.details, alert?.place].filter(Boolean).join(' ');
    const matches = text.match(/https?:\/\/[^\s<>()]+/gi) || [];
    return [...new Set(matches.map(link => link.replace(/[.,;]+$/, '')))];
  }

  function corePositionRecords() {
    return CORE_POSITIONS.map(item => ({
      id: `position-${item.key}`,
      name: item.name,
      policyStatus: item.policyStatus,
      source: item.source,
      removable: item.removable
    }));
  }

  function benchmarkRecords(definitions) {
    return definitions.map(item => ({
      ...item,
      completedAt: null,
      completedBy: ''
    }));
  }

  function ensurePolicyContent(incident, profileKey) {
    const definition = PROFILE_DEFINITIONS[profileKey] || PROFILE_DEFINITIONS.generic;
    incident.positions ||= [];
    incident.assignments ||= [];
    incident.benchmarks ||= [];

    [...CORE_POSITIONS, ...definition.positions].forEach(item => {
      const id = `position-${item.key}`;
      if (!incident.positions.some(positionItem => positionItem.id === id || positionItem.name.toLowerCase() === item.name.toLowerCase())) {
        incident.positions.push({ id, name: item.name, policyStatus: item.policyStatus, source: item.source, removable: item.removable });
      }
    });

    definition.tasks.forEach(name => {
      if (!incident.assignments.some(assignment => assignment.name.toLowerCase() === name.toLowerCase())) {
        incident.assignments.push({ id: uniqueId('task', name), name, policyStatus: 'derived', source: profileKey === 'generic' ? 'Command' : 'Policy-supported task', removable: true });
      }
    });

    [...UNIVERSAL_BENCHMARKS, ...definition.benchmarks].forEach(item => {
      if (!incident.benchmarks.some(existing => existing.id === item.id)) {
        incident.benchmarks.push({ ...item, completedAt: null, completedBy: '' });
      }
    });
  }

  function reconcileProfileContent(incident, profileKey) {
    const definition = PROFILE_DEFINITIONS[profileKey] || PROFILE_DEFINITIONS.generic;
    const targetTaskNames = new Set(definition.tasks.map(name => name.toLowerCase()));
    const automaticTaskNames = new Set(
      Object.values(PROFILE_DEFINITIONS).flatMap(item => item.tasks.map(name => name.toLowerCase()))
    );
    ['investigation', 'fire attack', 'search'].forEach(name => automaticTaskNames.add(name));
    const hasAssignedUnit = id => incident.units.some(unit => unit.assignmentId === id && unit.status !== 'released');

    incident.assignments = incident.assignments.filter(item => {
      if (targetTaskNames.has(item.name.toLowerCase())) return true;
      const generated = item.source === 'Policy-supported task' || (!item.source && automaticTaskNames.has(item.name.toLowerCase()));
      if (!generated) return true;
      if (hasAssignedUnit(item.id)) {
        item.source = 'Retained from prior profile';
        return true;
      }
      return false;
    });

    const targetPositionIds = new Set([
      ...CORE_POSITIONS.map(item => `position-${item.key}`),
      ...definition.positions.map(item => `position-${item.key}`)
    ]);
    const policyPositionIds = new Set(
      Object.values(PROFILE_DEFINITIONS).flatMap(item => item.positions.map(positionItem => `position-${positionItem.key}`))
    );
    incident.positions = incident.positions.filter(item => {
      if (targetPositionIds.has(item.id) || !policyPositionIds.has(item.id)) return true;
      if (hasAssignedUnit(item.id)) {
        item.source = 'Retained from prior profile';
        return true;
      }
      return false;
    });

    const targetBenchmarkIds = new Set([...UNIVERSAL_BENCHMARKS, ...definition.benchmarks].map(item => item.id));
    if (incident.strategy === 'defensive') {
      ['defensive_announced', 'interior_withdrawn', 'collapse_zone'].forEach(id => targetBenchmarkIds.add(id));
    }
    incident.benchmarks = incident.benchmarks.filter(item => targetBenchmarkIds.has(item.id) || Boolean(item.completedAt));
  }

  function createIncident(alert, source = 'Active911', overrides = {}) {
    const receivedMs = parseTimestamp(alert?.received) || Date.now();
    const units = parseUnits(alert?.units);
    const suggestedProfile = inferProfile(alert);
    const suggestedLevel = detectOperationalLevel(alert);
    const manualProfile = overrides.profile || 'generic';
    const isManual = source === 'Manual';
    const incident = {
      schemaVersion: 4,
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
      commander: '',
      commandDesignation: 'Command',
      profile: isManual ? manualProfile : 'generic',
      operationalLevel: 'initial',
      strategy: 'investigation',
      units: units.map(name => ({ name, assignmentId: 'bank', source: 'Active911', addedAt: nowIso(), status: 'available' })),
      positions: corePositionRecords(),
      assignments: [],
      benchmarks: benchmarkRecords(UNIVERSAL_BENCHMARKS),
      accountability: { dirty: true, confirmedAt: null },
      ric: { confirmed: false, confirmedAt: null },
      par: { due: false, reason: '', completedAt: null },
      mayday: null,
      suggestions: [],
      occupancy: '',
      floors: '',
      basement: 'unknown',
      links: extractLinks(alert),
      log: [{ at: nowIso(), message: `${source} incident opened in command board`, type: 'system' }]
    };

    if (!isManual && suggestedProfile !== 'generic') {
      incident.suggestions.push({ type: 'profile', value: suggestedProfile, source: 'Active911' });
    }
    if (!isManual && suggestedLevel !== 'initial') {
      incident.suggestions.push({ type: 'level', value: suggestedLevel, source: 'Active911' });
    }

    ensurePolicyContent(incident, incident.profile);
    completeBenchmarkRecord(incident, 'command_established', 'System', false);
    state.incident = incident;
    state.pendingAlert = null;
    state.selectedUnit = '';
    resetPages();
    persist();
    render();
  }

  function migrateIncident(raw) {
    if (!raw?.key) return null;
    const incident = raw;
    const priorSchemaVersion = Number(incident.schemaVersion || 1);
    incident.profile ||= 'generic';
    incident.operationalLevel ||= incident.mode === 'working_fire' ? 'working_fire' : 'initial';
    incident.strategy ||= ({ investigation: 'investigation', working_fire: 'offensive', rescue: 'investigation', hazmat: 'investigation', initial: 'investigation' })[incident.mode] || 'investigation';
    incident.commander ||= '';
    incident.commandDesignation ||= 'Command';
    incident.positions ||= corePositionRecords();
    incident.assignments ||= [];
    incident.benchmarks ||= benchmarkRecords(UNIVERSAL_BENCHMARKS);
    incident.accountability ||= { dirty: true, confirmedAt: null };
    incident.ric ||= { confirmed: false, confirmedAt: null };
    incident.par ||= { due: false, reason: '', completedAt: null };
    incident.mayday ||= null;
    incident.suggestions ||= [];
    incident.links ||= [];
    incident.log ||= [];
    incident.units ||= [];
    incident.units.forEach(unit => { unit.status ||= unit.assignmentId === 'bank' ? 'available' : 'assigned'; });

    const legacyCommand = incident.assignments.find(assignment => /^Command$/i.test(assignment.name));
    if (legacyCommand) {
      incident.units.filter(unit => unit.assignmentId === legacyCommand.id).forEach(unit => { unit.assignmentId = 'position-incident-command'; });
      incident.assignments = incident.assignments.filter(assignment => assignment !== legacyCommand);
    }

    if (incident.profile === 'generic') {
      const suggested = inferProfile(incident);
      if (suggested !== 'generic' && !incident.suggestions.some(item => item.type === 'profile' && item.value === suggested)) {
        incident.suggestions.push({ type: 'profile', value: suggested, source: 'Migration' });
      }
    }
    const incidentText = `${incident.description || ''} ${incident.details || ''}`.toUpperCase();
    const nonEmergencyLiftAssist = /\bLIFT(?:\s+ASSIST(?:ANCE)?)?\b/.test(incidentText) && !/ELEVATOR|ENTRAP|STUCK/.test(incidentText);
    if (priorSchemaVersion < 4 && nonEmergencyLiftAssist) {
      incident.suggestions = incident.suggestions.filter(item => !(item.type === 'profile' && item.value === 'elevator_rescue'));
      if (incident.operationalLevel !== 'initial' && !incident.suggestions.some(item => item.type === 'level' && item.value === 'initial')) {
        incident.suggestions.push({ type: 'level', value: 'initial', source: 'Lift-assist classification' });
      }
      if (incident.strategy !== 'investigation' && !incident.suggestions.some(item => item.type === 'strategy' && item.value === 'investigation')) {
        incident.suggestions.push({ type: 'strategy', value: 'investigation', source: 'Lift-assist classification' });
      }
    }
    if (priorSchemaVersion < 4) reconcileProfileContent(incident, incident.profile);
    ensurePolicyContent(incident, incident.profile);
    incident.schemaVersion = 4;
    return incident;
  }

  function logEntry(message, type = 'action') {
    if (!state.incident) return;
    state.incident.log.unshift({ at: nowIso(), message, type });
    persist();
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
      const current = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
      const legacy = current || JSON.parse(localStorage.getItem(LEGACY_STORAGE_KEY) || 'null');
      if (legacy?.key) {
        state.incident = migrateIncident(legacy);
        persist();
      }
    } catch (error) {
      console.warn('Unable to restore incident board state', error);
    }
  }

  function mergeAlert(alert) {
    const incident = state.incident;
    if (!incident) return;
    const changed = [];
    const mappings = [
      ['description', 'description', 'Incident type'], ['place', 'place', 'Place'],
      ['address', 'address', 'Address'], ['unit', 'unit', 'Address unit'],
      ['city', 'city', 'City'], ['state', 'state', 'State'],
      ['crossStreet', 'crossStreet', 'Cross street'], ['details', 'details', 'Narrative'],
      ['priority', 'priority', 'Priority'], ['units', 'dispatchedUnitsRaw', 'Dispatched units']
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
    added.forEach(name => incident.units.push({ name, assignmentId: 'bank', source: 'Active911', addedAt: nowIso(), status: 'available' }));
    if (added.length) {
      changed.push(`Added units: ${added.join(', ')}`);
      markAccountabilityDirty('Active911 added resources');
    }
    incident.links = [...new Set([...incident.links, ...extractLinks(alert)])];

    const suggestedProfile = inferProfile(alert);
    if (suggestedProfile !== 'generic' && suggestedProfile !== incident.profile) addSuggestion('profile', suggestedProfile, 'Active911');
    const suggestedLevel = detectOperationalLevel(alert);
    if (suggestedLevel !== 'initial' && suggestedLevel !== incident.operationalLevel) addSuggestion('level', suggestedLevel, 'Active911');

    if (changed.length) {
      incident.log.unshift({ at: nowIso(), message: `Active911 update — ${changed.join('; ')}`, type: 'update' });
      persist();
      render();
    }
  }

  function addSuggestion(type, value, source) {
    const incident = state.incident;
    if (!incident || incident.suggestions.some(item => item.type === type && item.value === value)) return;
    incident.suggestions.push({ type, value, source });
    incident.log.unshift({ at: nowIso(), message: `${source} suggested ${type}: ${suggestionValueLabel(type, value)}`, type: 'suggestion' });
    persist();
  }

  function suggestionValueLabel(type, value) {
    if (type === 'profile') return PROFILE_DEFINITIONS[value]?.label || value;
    if (type === 'level') return LEVEL_LABELS[value] || value;
    if (type === 'strategy') return STRATEGY_LABELS[value] || value;
    return value;
  }

  function changeProfile(profileKey, source = 'Command') {
    const incident = state.incident;
    if (!incident || !PROFILE_DEFINITIONS[profileKey] || incident.profile === profileKey) return;
    const prior = PROFILE_DEFINITIONS[incident.profile]?.label || incident.profile;
    incident.profile = profileKey;
    reconcileProfileContent(incident, profileKey);
    ensurePolicyContent(incident, profileKey);
    const definition = PROFILE_DEFINITIONS[profileKey];
    if ((definition.technicalRescue || profileKey === 'hazmat_generic') && incident.operationalLevel !== 'initial') {
      addSuggestion('level', 'initial', 'Policy fit');
    }
    if ((definition.technicalRescue || profileKey === 'hazmat_generic') && incident.strategy !== 'investigation') {
      addSuggestion('strategy', 'investigation', 'Policy fit');
    }
    incident.log.unshift({ at: nowIso(), message: `${source} changed incident profile from ${prior} to ${PROFILE_DEFINITIONS[profileKey].label}`, type: 'decision' });
    persist();
    render();
  }

  function changeLevel(level, source = 'Command') {
    const incident = state.incident;
    if (!incident || !LEVEL_LABELS[level] || incident.operationalLevel === level) return;
    const prior = LEVEL_LABELS[incident.operationalLevel] || incident.operationalLevel;
    incident.operationalLevel = level;
    setParDue(`Operational level changed from ${prior} to ${LEVEL_LABELS[level]}`);
    incident.log.unshift({ at: nowIso(), message: `${source} changed operational level from ${prior} to ${LEVEL_LABELS[level]}`, type: 'decision' });
    persist();
    render();
  }

  function changeStrategy(strategy) {
    const incident = state.incident;
    if (!incident || !STRATEGY_LABELS[strategy] || incident.strategy === strategy) return;
    const prior = STRATEGY_LABELS[incident.strategy] || incident.strategy;
    incident.strategy = strategy;
    setParDue(`Strategy changed from ${prior} to ${STRATEGY_LABELS[strategy]}`);
    if (strategy === 'offensive') {
      incident.ric.confirmed = false;
      incident.ric.confirmedAt = null;
    }
    if (strategy === 'defensive') {
      ensureBenchmark(incident, benchmark('defensive_announced', 'Defensive strategy announced', 'required', '701; 708'));
      ensureBenchmark(incident, benchmark('interior_withdrawn', 'Interior personnel withdrawn / accounted for', 'required', '708; 203'));
      ensureBenchmark(incident, benchmark('collapse_zone', 'Collapse zone considered / established', 'conditional', '708'));
    }
    incident.log.unshift({ at: nowIso(), message: `Strategy changed from ${prior} to ${STRATEGY_LABELS[strategy]}; PAR required`, type: 'decision' });
    persist();
    render();
  }

  function ensureBenchmark(incident, definition) {
    if (!incident.benchmarks.some(item => item.id === definition.id)) {
      incident.benchmarks.push({ ...definition, completedAt: null, completedBy: '' });
    }
  }

  function completeBenchmarkRecord(incident, id, actor = 'Command', createLog = true) {
    const item = incident?.benchmarks.find(benchmarkItem => benchmarkItem.id === id);
    if (!item || item.completedAt) return false;
    item.completedAt = nowIso();
    item.completedBy = actor;
    if (createLog) incident.log.unshift({ at: item.completedAt, message: `Benchmark complete — ${item.label}`, type: 'benchmark' });
    return true;
  }

  function toggleBenchmark(id) {
    const item = state.incident?.benchmarks.find(benchmarkItem => benchmarkItem.id === id);
    if (!item) return;
    if (item.completedAt) {
      item.completedAt = null;
      item.completedBy = '';
      logEntry(`Benchmark reopened — ${item.label}`, 'benchmark');
    } else {
      completeBenchmarkRecord(state.incident, id);
      if (id === 'accountability_active') {
        state.incident.accountability.dirty = false;
        state.incident.accountability.confirmedAt = nowIso();
      }
    }
    persist();
    render();
  }

  function markAccountabilityDirty(reason) {
    if (!state.incident) return;
    state.incident.accountability.dirty = true;
    state.incident.accountability.reason = reason;
    const item = state.incident.benchmarks.find(benchmarkItem => benchmarkItem.id === 'accountability_active');
    if (item) { item.completedAt = null; item.completedBy = ''; }
  }

  function confirmAccountability() {
    const incident = state.incident;
    if (!incident) return;
    incident.accountability.dirty = false;
    incident.accountability.confirmedAt = nowIso();
    completeBenchmarkRecord(incident, 'accountability_active', 'Command', false);
    logEntry('Personnel accountability confirmed', 'accountability');
    render();
  }

  function setParDue(reason) {
    if (!state.incident) return;
    state.incident.par.due = true;
    state.incident.par.reason = reason;
    state.incident.par.completedAt = null;
  }

  function completePar() {
    const incident = state.incident;
    if (!incident) return;
    incident.par.due = false;
    incident.par.completedAt = nowIso();
    const reason = incident.par.reason;
    incident.par.reason = '';
    incident.accountability.dirty = false;
    incident.accountability.confirmedAt = incident.par.completedAt;
    completeBenchmarkRecord(incident, 'accountability_active', 'PAR', false);
    logEntry(`PAR completed${reason ? ` — ${reason}` : ''}`, 'accountability');
    render();
  }

  function commandSpanCount() {
    const incident = state.incident;
    if (!incident) return 0;
    const filled = item => incident.units.some(unit => unit.assignmentId === item.id && unit.status !== 'released');
    const positionElements = incident.positions.filter(item => item.id !== 'position-incident-command' && filled(item)).length;
    const tacticalElements = incident.assignments.filter(filled).length;
    return positionElements + tacticalElements;
  }

  function ricIsRequired(incident = state.incident) {
    if (!incident) return false;
    const definition = PROFILE_DEFINITIONS[incident.profile];
    const offensiveFire = Boolean(definition?.fireProfile && incident.strategy === 'offensive');
    const entryAssignment = incident.units.some(unit => {
      if (unit.assignmentId === 'bank') return false;
      const assignment = incident.assignments.find(item => item.id === unit.assignmentId);
      return assignment && /ENTRY|FIRE ATTACK|INTERIOR/i.test(assignment.name);
    });
    return offensiveFire || entryAssignment;
  }

  function confirmRic() {
    const incident = state.incident;
    if (!incident) return;
    incident.ric.confirmed = true;
    incident.ric.confirmedAt = nowIso();
    logEntry('Rapid-intervention capability confirmed', 'safety');
    render();
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
    return hours ? `${hours}:${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')} elapsed` : `${minutes}:${String(remainder).padStart(2, '0')} elapsed`;
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

  function renderBoard(containerId, items, kind) {
    const container = $(containerId);
    if (!container || !state.incident) return;
    container.innerHTML = items.map(item => {
      const units = state.incident.units.filter(unit => unit.assignmentId === item.id);
      const removable = item.removable !== false && item.policyStatus !== 'required';
      const label = POLICY_STATUS[item.policyStatus] || POLICY_STATUS.derived;
      return `<section class="assignment-card ${kind}-card drop-zone" data-assignment-id="${escapeHtml(item.id)}">
        <header data-target-assignment="${escapeHtml(item.id)}">
          <div><h3>${escapeHtml(item.name)}</h3><small class="policy-tag ${escapeHtml(item.policyStatus || 'derived')}">${escapeHtml(label)}${item.source ? ` • ${escapeHtml(item.source)}` : ''}</small></div>
          ${removable ? `<button type="button" data-remove-${kind}="${escapeHtml(item.id)}" aria-label="Remove ${escapeHtml(item.name)}">×</button>` : ''}
        </header>
        <div class="assignment-units" data-target-assignment="${escapeHtml(item.id)}">${units.map(unitChip).join('')}</div>
      </section>`;
    }).join('');
  }

  function resetPages() {
    Object.keys(state.pages).forEach(key => { state.pages[key] = 0; });
  }

  function pagedItems(items, key) {
    const size = pageSizeFor(key);
    const totalPages = Math.max(1, Math.ceil(items.length / size));
    state.pages[key] = Math.min(Math.max(0, state.pages[key] || 0), totalPages - 1);
    const start = state.pages[key] * size;
    return { items: items.slice(start, start + size), page: state.pages[key], totalPages };
  }

  function pageSizeFor(key) {
    const dispatchBannerVisible = Boolean(state.pendingAlert && !$('newDispatchBanner').hidden);
    if (key === 'assignment' && dispatchBannerVisible) return 6;
    if (key !== 'benchmark') return PAGE_SIZES[key];
    const bankCount = state.incident?.units.filter(unit => unit.assignmentId === 'bank' && unit.status !== 'released').length || 0;
    if (dispatchBannerVisible || bankCount > PAGE_SIZES.bank) return 2;
    if (window.innerHeight < 950) return 3;
    return PAGE_SIZES.benchmark;
  }

  function updatePager(key, page, totalPages) {
    const config = {
      position: ['previousPositionPage', 'nextPositionPage', 'positionPageLabel', false],
      assignment: ['previousAssignmentPage', 'nextAssignmentPage', 'assignmentPageLabel', true],
      bank: ['previousBankPage', 'nextBankPage', 'bankPageLabel', false],
      benchmark: ['previousBenchmarkPage', 'nextBenchmarkPage', 'benchmarkPageLabel', true]
    }[key];
    const [previousId, nextId, labelId, includePageWord] = config;
    $(previousId).disabled = page <= 0;
    $(nextId).disabled = page >= totalPages - 1;
    $(labelId).textContent = `${includePageWord ? 'PAGE ' : ''}${page + 1} OF ${totalPages}`;
    if (key === 'bank') $(labelId).closest('.pager').hidden = totalPages <= 1;
  }

  function renderAssignments() {
    const incident = state.incident;
    if (!incident) return;
    const positionPage = pagedItems(incident.positions, 'position');
    const assignmentPage = pagedItems(incident.assignments, 'assignment');
    renderBoard('positionBoard', positionPage.items, 'position');
    renderBoard('assignmentBoard', assignmentPage.items, 'assignment');
    updatePager('position', positionPage.page, positionPage.totalPages);
    updatePager('assignment', assignmentPage.page, assignmentPage.totalPages);
    const bank = incident.units.filter(unit => unit.assignmentId === 'bank' && unit.status !== 'released');
    const bankPage = pagedItems(bank, 'bank');
    $('apparatusBank').innerHTML = bankPage.items.map(unitChip).join('');
    $('bankCount').textContent = String(bank.length);
    updatePager('bank', bankPage.page, bankPage.totalPages);
    bindAssignmentInteractions();
  }

  function renderBenchmarks() {
    const incident = state.incident;
    if (!incident) return;
    const complete = incident.benchmarks.filter(item => item.completedAt).length;
    $('benchmarkCount').textContent = `${complete}/${incident.benchmarks.length}`;
    const benchmarkPage = pagedItems(incident.benchmarks, 'benchmark');
    $('benchmarkList').innerHTML = benchmarkPage.items.map(item => {
      const completed = Boolean(item.completedAt);
      const status = POLICY_STATUS[item.policyStatus] || item.policyStatus;
      return `<button class="benchmark-item${completed ? ' complete' : ''}" type="button" data-benchmark="${escapeHtml(item.id)}" aria-pressed="${completed}">
        <span class="benchmark-check">${completed ? '✓' : ''}</span>
        <span class="benchmark-copy"><strong>${escapeHtml(item.label)}</strong><small>${escapeHtml(status)} • ${escapeHtml(item.source)}</small>${completed ? `<em>${escapeHtml(formatClock(item.completedAt))}</em>` : ''}</span>
      </button>`;
    }).join('');
    updatePager('benchmark', benchmarkPage.page, benchmarkPage.totalPages);
    document.querySelectorAll('[data-benchmark]').forEach(button => button.addEventListener('click', () => toggleBenchmark(button.dataset.benchmark)));
  }

  function renderSafety() {
    const incident = state.incident;
    if (!incident) return;
    setSafetyStatus('accountabilityStatus', 'Accountability', incident.accountability.dirty ? 'Needs confirmation' : `Confirmed ${formatClock(incident.accountability.confirmedAt)}`, incident.accountability.dirty ? 'danger' : 'good');
    const ricRequired = ricIsRequired(incident);
    const ricText = incident.ric.confirmed ? `Confirmed ${formatClock(incident.ric.confirmedAt)}` : ricRequired ? 'REQUIRED — not confirmed' : 'Not currently required';
    setSafetyStatus('ricStatus', 'RIC Capability', ricText, incident.ric.confirmed ? 'good' : ricRequired ? 'danger' : 'neutral');
    setSafetyStatus('parStatus', 'PAR', incident.par.due ? `DUE — ${incident.par.reason}` : incident.par.completedAt ? `Complete ${formatClock(incident.par.completedAt)}` : 'Current', incident.par.due ? 'danger' : 'good');
    const span = commandSpanCount();
    const spanText = span === 5 ? '5 active elements — ideal' : `${span} active element${span === 1 ? '' : 's'}`;
    setSafetyStatus('spanStatus', 'Command Span', spanText, span > 7 ? 'danger' : span >= 3 ? 'good' : 'neutral');
    $('completeParButton').disabled = !incident.par.due;
    $('confirmRicButton').disabled = incident.ric.confirmed;
    $('confirmAccountabilityButton').disabled = !incident.accountability.dirty;

    const activeMayday = incident.mayday && !incident.mayday.resolvedAt;
    $('maydayBanner').hidden = !activeMayday;
    if (activeMayday) {
      $('maydaySummary').textContent = `${incident.mayday.member} • ${incident.mayday.location} • ${incident.mayday.problem}`;
    }
  }

  function setSafetyStatus(id, label, value, stateClass) {
    const element = $(id);
    if (!element) return;
    element.className = `safety-status ${stateClass}`;
    element.innerHTML = `<span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong>`;
  }

  function renderSuggestion() {
    const suggestion = state.incident?.suggestions?.[0];
    $('policySuggestion').hidden = !suggestion;
    if (!suggestion) return;
    const noun = suggestion.type === 'profile' ? 'Incident profile' : suggestion.type === 'level' ? 'Operational level' : 'Strategy';
    $('policySuggestionText').textContent = `${noun}: ${suggestionValueLabel(suggestion.type, suggestion.value)}`;
  }

  function renderLog() {
    if (!state.incident) return;
    $('commandLog').innerHTML = state.incident.log.map(entry => `<li><time>${escapeHtml(formatClock(entry.at))}</time><span>${escapeHtml(entry.message)}</span></li>`).join('');
  }

  function renderDetails() {
    const incident = state.incident;
    if (!incident) return;
    const pairs = [
      ['Call type', incident.description],
      ['Profile', PROFILE_DEFINITIONS[incident.profile]?.label],
      ['Level / Strategy', `${LEVEL_LABELS[incident.operationalLevel]} / ${STRATEGY_LABELS[incident.strategy]}`],
      ['Address', [incident.address, incident.unit, incident.city, incident.state].filter(Boolean).join(' ')],
      ['Cross street', incident.crossStreet], ['CAD number', incident.cadCode],
      ['Dispatched units', incident.dispatchedUnitsRaw], ['Priority', incident.priority], ['Narrative', incident.details]
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
      $('latestAlertSummary').textContent = alert ? `${alert.description || 'Emergency Call'} • ${[alert.address, alert.unit, alert.city].filter(Boolean).join(' ') || 'Location unavailable'}` : 'Waiting for the latest Active911 dispatch…';
      $('maydayBanner').hidden = true;
      return;
    }

    const incident = state.incident;
    $('incidentType').textContent = incident.description || 'Emergency Call';
    $('incidentLocation').textContent = [incident.place, incident.address, incident.unit, incident.city].filter(Boolean).join(' • ') || 'Location unavailable';
    $('incidentNumber').textContent = incident.cadCode ? `Incident ${incident.cadCode}` : 'Manual incident';
    $('incidentReceived').textContent = `Received ${formatClock(incident.received, true)}`;
    $('commandDesignation').textContent = incident.commander ? `${incident.commandDesignation} • IC ${incident.commander}` : incident.commandDesignation;
    $('incidentElapsed').textContent = elapsedText(incident.startedAt);
    $('profileSelect').value = incident.profile;
    $('occupancyInput').value = incident.occupancy || '';
    $('floorsInput').value = incident.floors || '';
    $('basementInput').value = incident.basement || 'unknown';
    document.querySelectorAll('#levelButtons button').forEach(button => button.classList.toggle('active', button.dataset.level === incident.operationalLevel));
    document.querySelectorAll('#strategyButtons button').forEach(button => button.classList.toggle('active', button.dataset.strategy === incident.strategy));
    $('preplanLinks').innerHTML = incident.links.map((link, index) => `<a href="${escapeHtml(link)}" target="_blank" rel="noopener noreferrer">Open Active911 / Preplan Link ${index + 1}</a>`).join('');
    renderSuggestion();
    renderAssignments();
    renderBenchmarks();
    renderSafety();
    renderLog();
    renderDetails();
  }

  function moveUnit(unitName, assignmentId) {
    const incident = state.incident;
    const unit = incident?.units.find(item => item.name === unitName);
    if (!unit || unit.assignmentId === assignmentId) {
      state.selectedUnit = '';
      renderAssignments();
      return;
    }
    const previous = assignmentName(unit.assignmentId);
    const next = assignmentName(assignmentId);
    if (!next) return;
    unit.assignmentId = assignmentId;
    unit.status = assignmentId === 'bank' ? 'available' : 'assigned';
    state.selectedUnit = '';
    markAccountabilityDirty(`${unit.name} reassigned`);
    logEntry(`${unit.name} moved from ${previous} to ${next}; accountability requires confirmation`);
    render();
  }

  function assignmentName(id) {
    if (id === 'bank') return 'Apparatus Bank';
    const incident = state.incident;
    return incident?.positions.find(item => item.id === id)?.name || incident?.assignments.find(item => item.id === id)?.name || '';
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
        if (event.target.closest('[data-remove-position], [data-remove-assignment]')) return;
        if (state.selectedUnit) moveUnit(state.selectedUnit, target.dataset.targetAssignment);
      });
    });
    document.querySelectorAll('[data-remove-position]').forEach(button => button.addEventListener('click', event => requestRemoveBoardItem(event, 'position', button.dataset.removePosition)));
    document.querySelectorAll('[data-remove-assignment]').forEach(button => button.addEventListener('click', event => requestRemoveBoardItem(event, 'assignment', button.dataset.removeAssignment)));
  }

  function requestRemoveBoardItem(event, kind, id) {
    event.stopPropagation();
    const listName = kind === 'position' ? 'positions' : 'assignments';
    const item = state.incident[listName].find(candidate => candidate.id === id);
    if (!item || item.removable === false || item.policyStatus === 'required') return;
    const assignedUnits = state.incident.units.filter(unit => unit.assignmentId === item.id && unit.status !== 'released');
    state.pendingRemoval = { kind, id };
    $('removeBoardItemTitle').textContent = `Delete ${item.name}?`;
    $('removeBoardItemMessage').textContent = assignedUnits.length
      ? `${assignedUnits.map(unit => unit.name).join(', ')} will return to the Apparatus Bank and accountability will require confirmation.`
      : 'This Command-created board item will be removed.';
    $('confirmRemoveBoardItemButton').textContent = kind === 'position' ? 'Delete Position' : 'Delete Assignment';
    $('removeBoardItemDialog').showModal();
  }

  function confirmRemoveBoardItem() {
    const pending = state.pendingRemoval;
    if (!pending || !state.incident) return;
    const listName = pending.kind === 'position' ? 'positions' : 'assignments';
    const item = state.incident[listName].find(candidate => candidate.id === pending.id);
    if (!item || item.removable === false || item.policyStatus === 'required') return;
    state.incident.units.filter(unit => unit.assignmentId === item.id).forEach(unit => { unit.assignmentId = 'bank'; unit.status = 'available'; });
    state.incident[listName] = state.incident[listName].filter(candidate => candidate.id !== item.id);
    markAccountabilityDirty(`${item.name} removed`);
    logEntry(`${item.name} ${pending.kind} removed; assigned units returned to the bank`);
    state.pendingRemoval = null;
    $('removeBoardItemDialog').close();
    render();
  }

  function cancelRemoveBoardItem() {
    state.pendingRemoval = null;
    $('removeBoardItemDialog').close();
  }

  function changePage(key, delta) {
    state.pages[key] = Math.max(0, (state.pages[key] || 0) + delta);
    if (key === 'benchmark') renderBenchmarks();
    else renderAssignments();
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>'"]/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character]);
  }

  function showPendingAlert(alert) {
    state.pendingAlert = alert;
    $('newDispatchSummary').textContent = `${alert.description || 'Emergency Call'} • ${[alert.address, alert.unit, alert.city].filter(Boolean).join(' ') || 'Location unavailable'}`;
    $('newDispatchBanner').hidden = false;
    if (state.incident) { renderAssignments(); renderBenchmarks(); }
  }

  function hidePendingAlert() {
    $('newDispatchBanner').hidden = true;
    if (state.incident) { renderAssignments(); renderBenchmarks(); }
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
      if (!state.incident) render();
      else if (incidentKey(alert) === state.incident.key) mergeAlert(alert);
      else if (incidentKey(alert) !== incidentKey(state.pendingAlert)) showPendingAlert(alert);
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
      ['WTFD Incident Command Log'], ['Incident', incident.cadCode || incident.key],
      ['Call Type', incident.description], ['Profile', PROFILE_DEFINITIONS[incident.profile]?.label],
      ['Operational Level', LEVEL_LABELS[incident.operationalLevel]], ['Strategy', STRATEGY_LABELS[incident.strategy]],
      ['Incident Commander', incident.commander], ['Command Designation', incident.commandDesignation],
      ['Location', [incident.address, incident.unit, incident.city, incident.state].filter(Boolean).join(' ')],
      ['Received', incident.received], ['Command Started', incident.commandStartedAt],
      ['Occupancy', incident.occupancy], ['Floors', incident.floors], ['Basement', incident.basement],
      [], ['Time', 'Event']
    ];
    [...incident.log].reverse().forEach(entry => rows.push([entry.at, entry.message]));
    rows.push([], ['Command Organization']);
    incident.positions.forEach(item => rows.push([item.name, incident.units.filter(unit => unit.assignmentId === item.id).map(unit => unit.name).join(', '), item.policyStatus, item.source]));
    rows.push([], ['Tactical Assignments']);
    incident.assignments.forEach(item => rows.push([item.name, incident.units.filter(unit => unit.assignmentId === item.id).map(unit => unit.name).join(', ')]));
    rows.push([], ['Benchmarks']);
    incident.benchmarks.forEach(item => rows.push([item.label, item.completedAt || 'Open', POLICY_STATUS[item.policyStatus], item.source]));
    rows.push(['Apparatus Bank', incident.units.filter(unit => unit.assignmentId === 'bank').map(unit => unit.name).join(', ')]);
    downloadCsv(rows, `WTFD-Command-${(incident.cadCode || Date.now()).replace(/[^a-z0-9-]/gi, '_')}.csv`);
    logEntry('Command log exported');
  }

  function downloadCsv(rows, filename) {
    const csv = rows.map(row => row.map(value => `"${String(value ?? '').replace(/"/g, '""')}"`).join(',')).join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(link.href);
  }

  function openTransferDialog() {
    const activeMayday = state.incident?.mayday && !state.incident.mayday.resolvedAt;
    const readinessWarning = !activeMayday && (state.incident?.par?.due || state.incident?.accountability?.dirty);
    $('transferBlockMessage').hidden = !activeMayday && !readinessWarning;
    $('transferBlockMessage').textContent = activeMayday
      ? 'Command transfer is blocked while a MAYDAY is active.'
      : readinessWarning ? 'PAR or accountability is not current. Resolve it before completing the transfer briefing.' : '';
    $('transferCommandForm').querySelector('button[type="submit"]').disabled = Boolean(activeMayday);
    $('transferCommandDialog').showModal();
  }

  function openEndIncidentDialog() {
    const incident = state.incident;
    if (!incident) return;
    const activeMayday = incident.mayday && !incident.mayday.resolvedAt;
    const requiredOpen = incident.benchmarks.filter(item => item.policyStatus === 'required' && !item.completedAt);
    $('endIncidentBlockMessage').hidden = !activeMayday;
    $('endIncidentBlockMessage').textContent = activeMayday ? 'Incident termination is blocked while a MAYDAY is active.' : '';
    $('endIncidentWarning').hidden = requiredOpen.length === 0;
    $('endIncidentWarning').textContent = requiredOpen.length
      ? `${requiredOpen.length} required benchmark${requiredOpen.length === 1 ? ' remains' : 's remain'} open. Complete or document applicability before termination.`
      : '';
    $('confirmEndIncident').disabled = Boolean(activeMayday);
    $('endIncidentDialog').showModal();
  }

  function completeTransfer(event) {
    event.preventDefault();
    const incident = state.incident;
    if (!incident || (incident.mayday && !incident.mayday.resolvedAt)) return;
    const form = event.currentTarget;
    if (!form.checkValidity()) { form.reportValidity(); return; }
    const values = Object.fromEntries(new FormData(form));
    incident.commander = String(values.incomingCommander || '').trim();
    incident.commandDesignation = String(values.designation || 'Command').trim();
    markAccountabilityDirty('Command transferred');
    setParDue('Command transfer');
    logEntry(`Command transferred to ${incident.commander}; designation ${incident.commandDesignation}; accountability confirmation and PAR required`, 'command');
    form.reset();
    $('transferCommandDialog').close();
    render();
  }

  function activateMayday(event) {
    event.preventDefault();
    const form = event.currentTarget;
    if (!form.checkValidity()) { form.reportValidity(); return; }
    const values = Object.fromEntries(new FormData(form));
    state.incident.mayday = {
      member: String(values.member || '').trim(), location: String(values.location || '').trim(),
      problem: String(values.problem || '').trim(), declaredAt: nowIso(), resolvedAt: null
    };
    setParDue('MAYDAY / emergency condition');
    state.incident.accountability.dirty = true;
    logEntry(`MAYDAY declared — ${state.incident.mayday.member}; last known ${state.incident.mayday.location}; ${state.incident.mayday.problem}. Emergency traffic and RIC workflow active.`, 'emergency');
    form.reset();
    $('maydayDialog').close();
    render();
  }

  function resolveMayday() {
    const mayday = state.incident?.mayday;
    if (!mayday || mayday.resolvedAt) return;
    mayday.resolvedAt = nowIso();
    setParDue('MAYDAY resolved');
    logEntry(`MAYDAY resolved for ${mayday.member}; PAR required`, 'emergency');
    render();
  }

  function endIncident(event) {
    event.preventDefault();
    const form = event.currentTarget;
    if (state.incident?.mayday && !state.incident.mayday.resolvedAt) return;
    if (!form.checkValidity()) { form.reportValidity(); return; }
    const incident = state.incident;
    if (!incident) return;
    completeBenchmarkRecord(incident, 'accountability_active', 'Final PAR', false);
    incident.log.unshift({ at: nowIso(), message: 'Incident objectives achieved; hazards addressed; final accountability confirmed; command terminated', type: 'termination' });
    incident.closedAt = nowIso();
    try { localStorage.setItem(LAST_CLOSED_KEY, JSON.stringify(incident)); } catch (_) {}
    state.incident = null;
    state.selectedUnit = '';
    persist();
    hidePendingAlert();
    form.reset();
    $('endIncidentDialog').close();
    render();
  }

  function bindEvents() {
    $('startLatestButton').addEventListener('click', () => state.latestAlert && createIncident(state.latestAlert));
    $('startManualButton').addEventListener('click', () => $('manualIncidentDialog').showModal());
    $('closeManualIncidentButton').addEventListener('click', () => $('manualIncidentDialog').close());
    $('cancelManualIncidentButton').addEventListener('click', () => $('manualIncidentDialog').close());
    $('manualIncidentForm').addEventListener('submit', event => {
      if (event.submitter?.value === 'cancel') return;
      event.preventDefault();
      const values = Object.fromEntries(new FormData(event.currentTarget));
      createIncident({ ...values, id: `manual-${Date.now()}`, received: nowIso(), units: '' }, 'Manual', { profile: values.profile });
      $('manualIncidentDialog').close();
      event.currentTarget.reset();
    });

    $('profileSelect').addEventListener('change', event => changeProfile(event.target.value));
    $('levelButtons').addEventListener('click', event => { const button = event.target.closest('[data-level]'); if (button) changeLevel(button.dataset.level); });
    $('strategyButtons').addEventListener('click', event => { const button = event.target.closest('[data-strategy]'); if (button) changeStrategy(button.dataset.strategy); });

    $('confirmSuggestionButton').addEventListener('click', () => {
      const suggestion = state.incident?.suggestions?.shift();
      if (!suggestion) return;
      if (suggestion.type === 'profile') changeProfile(suggestion.value, suggestion.source);
      if (suggestion.type === 'level') changeLevel(suggestion.value, suggestion.source);
      if (suggestion.type === 'strategy') changeStrategy(suggestion.value);
      persist();
      render();
    });
    $('dismissSuggestionButton').addEventListener('click', () => {
      const suggestion = state.incident?.suggestions?.shift();
      if (suggestion) logEntry(`${suggestion.source} suggestion dismissed — ${suggestionValueLabel(suggestion.type, suggestion.value)}`, 'decision');
      render();
    });

    $('confirmAccountabilityButton').addEventListener('click', confirmAccountability);
    $('confirmRicButton').addEventListener('click', confirmRic);
    $('completeParButton').addEventListener('click', completePar);
    $('maydayButton').addEventListener('click', () => $('maydayDialog').showModal());
    $('maydayForm').addEventListener('submit', activateMayday);
    $('closeMaydayButton').addEventListener('click', () => $('maydayDialog').close());
    $('cancelMaydayButton').addEventListener('click', () => $('maydayDialog').close());
    $('resolveMaydayButton').addEventListener('click', resolveMayday);

    $('addUnitForm').addEventListener('submit', event => {
      event.preventDefault();
      const name = cleanUnit($('addUnitInput').value);
      if (!name || state.incident.units.some(unit => unit.name === name)) return;
      state.incident.units.push({ name, assignmentId: 'bank', source: 'Manual', addedAt: nowIso(), status: 'available' });
      state.pages.bank = Math.floor((state.incident.units.filter(unit => unit.assignmentId === 'bank' && unit.status !== 'released').length - 1) / pageSizeFor('bank'));
      $('addUnitInput').value = '';
      markAccountabilityDirty(`${name} added`);
      logEntry(`${name} added manually to apparatus bank; accountability requires confirmation`);
      render();
    });

    $('addPositionButton').addEventListener('click', () => $('addPositionDialog').showModal());
    $('closeAddPositionButton').addEventListener('click', () => $('addPositionDialog').close());
    $('cancelAddPositionButton').addEventListener('click', () => $('addPositionDialog').close());
    $('addPositionForm').addEventListener('submit', event => {
      if (event.submitter?.value === 'cancel') return;
      event.preventDefault();
      const values = Object.fromEntries(new FormData(event.currentTarget));
      const name = String(values.name || '').trim();
      if (name && !state.incident.positions.some(item => item.name.toLowerCase() === name.toLowerCase())) {
        state.incident.positions.push({ id: uniqueId('position', name), name, policyStatus: values.policyStatus || 'derived', source: 'Command', removable: true });
        state.pages.position = Math.floor((state.incident.positions.length - 1) / PAGE_SIZES.position);
        logEntry(`${name} command position added`);
      }
      $('addPositionDialog').close();
      event.currentTarget.reset();
      render();
    });

    $('addAssignmentButton').addEventListener('click', () => $('addAssignmentDialog').showModal());
    $('closeAddAssignmentButton').addEventListener('click', () => $('addAssignmentDialog').close());
    $('cancelAddAssignmentButton').addEventListener('click', () => $('addAssignmentDialog').close());
    $('addAssignmentForm').addEventListener('submit', event => {
      if (event.submitter?.value === 'cancel') return;
      event.preventDefault();
      const name = String(new FormData(event.currentTarget).get('name') || '').trim();
      if (name && !state.incident.assignments.some(item => item.name.toLowerCase() === name.toLowerCase())) {
        state.incident.assignments.push({ id: uniqueId('task', name), name, policyStatus: 'derived', source: 'Command', removable: true });
        state.pages.assignment = Math.floor((state.incident.assignments.length - 1) / PAGE_SIZES.assignment);
        logEntry(`${name} tactical assignment added`);
      }
      $('addAssignmentDialog').close();
      event.currentTarget.reset();
      render();
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

    $('transferCommandButton').addEventListener('click', openTransferDialog);
    $('transferCommandForm').addEventListener('submit', completeTransfer);
    $('closeTransferButton').addEventListener('click', () => $('transferCommandDialog').close());
    $('cancelTransferButton').addEventListener('click', () => $('transferCommandDialog').close());

    $('clearIncidentButton').addEventListener('click', openEndIncidentDialog);
    $('endIncidentForm').addEventListener('submit', endIncident);
    $('closeEndIncidentButton').addEventListener('click', () => $('endIncidentDialog').close());
    $('cancelEndIncidentButton').addEventListener('click', () => $('endIncidentDialog').close());

    $('dismissDispatchButton').addEventListener('click', hidePendingAlert);
    $('viewDispatchButton').addEventListener('click', () => {
      const alert = state.pendingAlert;
      if (!alert) return;
      $('newDispatchDetails').innerHTML = `<h3>${escapeHtml(alert.description || 'Emergency Call')}</h3><p>${escapeHtml([alert.address, alert.unit, alert.city].filter(Boolean).join(' '))}</p><p><strong>Units:</strong> ${escapeHtml(alert.units || 'Not listed')}</p><p>${escapeHtml(alert.details || '')}</p>`;
      $('newDispatchDialog').showModal();
    });
    $('closeDispatchDialog').addEventListener('click', () => $('newDispatchDialog').close());
    $('previousPositionPage').addEventListener('click', () => changePage('position', -1));
    $('nextPositionPage').addEventListener('click', () => changePage('position', 1));
    $('previousAssignmentPage').addEventListener('click', () => changePage('assignment', -1));
    $('nextAssignmentPage').addEventListener('click', () => changePage('assignment', 1));
    $('previousBankPage').addEventListener('click', () => changePage('bank', -1));
    $('nextBankPage').addEventListener('click', () => changePage('bank', 1));
    $('previousBenchmarkPage').addEventListener('click', () => changePage('benchmark', -1));
    $('nextBenchmarkPage').addEventListener('click', () => changePage('benchmark', 1));
    $('confirmRemoveBoardItemButton').addEventListener('click', confirmRemoveBoardItem);
    $('closeRemoveBoardItemButton').addEventListener('click', cancelRemoveBoardItem);
    $('cancelRemoveBoardItemButton').addEventListener('click', cancelRemoveBoardItem);
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
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') pollActive911(); });

  window.WTFD_COMMAND_TEST = {
    parseUnits,
    incidentKey,
    inferProfile,
    detectOperationalLevel,
    extractLinks,
    parseTimestamp,
    formatClock,
    migrateIncident,
    PROFILE_DEFINITIONS,
    PAGE_SIZES,
    pageSizeFor
  };
})();
