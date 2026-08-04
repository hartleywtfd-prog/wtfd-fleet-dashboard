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
  localStorage
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
vm.runInContext(source, context);

const helpers = window.WTFD_COMMAND_TEST;

assert.deepEqual(
  Array.from(helpers.parseUnits('B40, Engine 41, M-43 / Ladder 41')),
  ['B40', 'E41', 'M43', 'L41']
);
assert.equal(helpers.incidentKey({ id: '123', cadCode: '2026-100' }), '2026-100');
assert.equal(helpers.incidentKey({ id: '123' }), '123');
assert.equal(helpers.inferProfile({ description: 'LIFT ASSIST' }), 'elevator_rescue');
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
assert.equal(migrated.schemaVersion, 2);
assert.equal(migrated.operationalLevel, 'working_fire');
assert.equal(migrated.strategy, 'offensive');
assert.ok(migrated.positions.some(position => position.id === 'position-incident-command'));
assert.equal(migrated.units[0].assignmentId, 'position-incident-command');
assert.ok(migrated.benchmarks.some(item => item.id === 'command_established'));
assert.ok(migrated.suggestions.some(item => item.type === 'profile' && item.value === 'structure_fire'));

console.log('Incident command helper tests passed.');
