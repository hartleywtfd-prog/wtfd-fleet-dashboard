import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const elements = new Map();
const element = () => ({
  hidden: false,
  disabled: false,
  value: '',
  textContent: '',
  innerHTML: '',
  className: '',
  classList: { add() {}, remove() {}, toggle() {} },
  addEventListener() {},
  querySelectorAll() { return []; },
  showModal() {},
  close() {}
});

const document = {
  visibilityState: 'visible',
  fullscreenElement: null,
  documentElement: { requestFullscreen: async () => {} },
  getElementById(id) {
    if (!elements.has(id)) elements.set(id, element());
    return elements.get(id);
  },
  querySelectorAll() { return []; },
  addEventListener() {},
  exitFullscreen: async () => {}
};

const localStorage = {
  values: new Map(),
  getItem(key) { return this.values.get(key) || null; },
  setItem(key, value) { this.values.set(key, value); },
  removeItem(key) { this.values.delete(key); }
};

const window = {
  addEventListener() {},
  print() {},
  localStorage,
  innerHeight: 900
};

const context = vm.createContext({
  console,
  document,
  window,
  localStorage,
  setInterval() {},
  setTimeout() {},
  clearInterval() {},
  clearTimeout() {},
  fetch: async () => ({ ok: true, json: async () => ({ alert: null }) }),
  Blob,
  URL,
  FormData: class {},
  Date,
  Math
});

const source = fs.readFileSync(new URL('../command.js', import.meta.url), 'utf8');
const html = fs.readFileSync(new URL('../command.html', import.meta.url), 'utf8');
vm.runInContext(source, context);

const helpers = window.WTFD_COMMAND_TEST;

assert.deepEqual(
  Array.from(helpers.parseUnits('B40, Engine 41, M-43 / Ladder 41')),
  ['B40', 'E41', 'M43', 'L41']
);
assert.deepEqual(
  Array.from(helpers.parseUnits('BC40 BAT-41 Battalion Chief 42 Truck 41')),
  ['B40', 'B41', 'B42', 'L41']
);
assert.deepEqual(
  Array.from(helpers.parseAlertUnits({ units: ['E44', { call_sign: 'BC40' }], details: 'Assigned: E42' })),
  ['E44', 'B40', 'E42']
);
assert.equal(helpers.incidentKey({ id: '123', cadCode: '2026-100' }), '2026-100');
assert.deepEqual(
  Array.from(helpers.parseUnits('BC40 BAT-41 Battalion Chief 42 Truck 41')),
  ['B40', 'B41', 'B42', 'L41']
);
assert.deepEqual(
  Array.from(helpers.parseAlertUnits({ units: ['E44', { call_sign: 'BC40' }], details: 'Assigned: E42' })),
  ['E44', 'B40', 'E42']
);
assert.equal(helpers.incidentKey({ id: '123' }), '123');
assert.equal(helpers.inferProfile({ description: 'LIFT ASSIST' }), 'generic');
assert.equal(helpers.inferProfile({ description: 'ELEVATOR ENTRAPMENT' }), 'elevator_rescue');
assert.equal(helpers.inferProfile({ description: 'BASEMENT FIRE' }), 'basement_fire');
assert.equal(helpers.inferProfile({ description: 'CONFINED SPACE RESCUE' }), 'confined_space');
assert.equal(helpers.inferProfile({ description: 'VEHACC - ENTRAPMENT' }), 'vehicle_machinery_rescue');
assert.equal(helpers.inferProfile({ description: 'FIRE - STRUCTURE' }), 'structure_fire');
assert.equal(helpers.detectOperationalLevel({ description: 'FIRE', details: 'Command reports working fire' }), 'working_fire');
assert.equal(helpers.detectOperationalLevel({ description: 'SECOND ALARM FIRE' }), 'additional_alarm');
assert.deepEqual(
  Array.from(helpers.extractLinks({ details: 'Preplan https://example.com/a.pdf. Map https://example.com/map' })),
  ['https://example.com/a.pdf', 'https://example.com/map']
);
assert.equal(
  helpers.parseTimestamp('2026-08-04 14:26:00'),
  Date.UTC(2026, 7, 4, 14, 26, 0)
);
assert.match(helpers.formatClock('2026-08-04 14:26:00', true), /10:26 AM/);

const migrated = helpers.migrateIncident({
  key: 'legacy-1',
  mode: 'working_fire',
  description: 'STRUCTURE FIRE',
  units: [{ name: 'E41', assignmentId: 'legacy-command' }],
  assignments: [{ id: 'legacy-command', name: 'Command' }],
  log: []
});
assert.equal(migrated.schemaVersion, 5);
assert.equal(migrated.operationalLevel, 'working_fire');
assert.equal(migrated.strategy, 'offensive');
assert.ok(migrated.positions.some(position => position.id === 'position-incident-command'));
assert.equal(migrated.units[0].assignmentId, 'position-incident-command');
assert.ok(migrated.benchmarks.some(item => item.id === 'command_established'));
assert.ok(migrated.suggestions.some(item => item.type === 'profile' && item.value === 'structure_fire'));
assert.equal(migrated.assignments.some(item => item.name === 'Command'), false);

const liftAssist = helpers.migrateIncident({
  schemaVersion: 3,
  key: 'lift-1',
  description: 'LIFT',
  operationalLevel: 'working_fire',
  strategy: 'offensive',
  profile: 'generic',
  units: [],
  positions: [],
  assignments: [{ id: 'old-fire', name: 'Fire Attack', removable: true }],
  benchmarks: [],
  suggestions: [{ type: 'profile', value: 'elevator_rescue', source: 'Active911' }],
  log: []
});
assert.equal(liftAssist.suggestions.some(item => item.value === 'elevator_rescue'), false);
assert.ok(liftAssist.suggestions.some(item => item.type === 'level' && item.value === 'initial'));
assert.ok(liftAssist.suggestions.some(item => item.type === 'strategy' && item.value === 'investigation'));
assert.equal(liftAssist.assignments.some(item => item.name === 'Fire Attack'), false);
const rehabMigration = helpers.migrateIncident({
  schemaVersion: 4,
  key: 'rehab-1',
  description: 'FIRE',
  profile: 'generic',
  operationalLevel: 'initial',
  strategy: 'investigation',
  units: [], positions: [], benchmarks: [], suggestions: [], log: [],
  assignments: [{ id: 'hazmat', name: 'Hazmat Group', policyStatus: 'derived', source: 'Command', removable: true }]
});
assert.ok(rehabMigration.assignments.some(item => item.name === 'Rehab'));
assert.equal(helpers.normalizeCrewSenseAssignment('BAT40'), 'bc40');
assert.equal(helpers.normalizeCrewSenseAssignment('Battalion 40'), 'bc40');
assert.equal(helpers.normalizeCrewSenseAssignment('Medic 45'), 'm45');
assert.equal(helpers.benchmarkResolved({ completedAt: null, notApplicableAt: '2026-08-04T12:00:00Z' }), true);

for (const id of ['cancelManualIncidentButton', 'cancelAddPositionButton', 'cancelAddAssignmentButton']) {
  assert.match(html, new RegExp(`<button[^>]*id="${id}"[^>]*type="button"`));
}
assert.equal(helpers.PAGE_SIZES.assignment, 9);
assert.equal(helpers.PAGE_SIZES.bank, 9);
assert.equal(helpers.PAGE_SIZES.benchmark, 4);
assert.equal(helpers.pageSizeFor('benchmark'), 3);
assert.match(html, /id="confirmRemoveBoardItemButton"/);
assert.match(html, /id="benchmarkPageLabel"/);

console.log('Incident command helper tests passed.');
