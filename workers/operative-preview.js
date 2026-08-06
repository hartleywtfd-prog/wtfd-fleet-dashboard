const AUTH_URL = 'https://auth.operativeiqfrontline.com/FrontlineV_live/token';
const RESOURCE_ROOT = 'https://client.operativeiqfrontline.com/FrontlineV_live';
const PAGE_SIZE = 200;
const IGNORED_APPARATUS = new Set(['F140']);
const SWAGGER_CANDIDATES = [
  '/swagger/docs/v1',
  '/swagger/docs/v2',
  '/swagger/v1/swagger.json',
  '/swagger/v2/swagger.json',
  '/swagger/swagger.json',
  '/swagger.json',
  '/openapi.json'
];
const ASSIGNMENT_RESOURCE_CANDIDATES = [
  '/api/call-signs',
  '/api/callsigns',
  '/api/unit-assignments',
  '/api/unitassignments',
  '/api/assignments',
  '/api/unit-statuses',
  '/api/unitstatuses',
  '/api/truck-statuses',
  '/api/truckstatuses',
  '/api/unit-service-statuses',
  '/api/unitservicestatuses',
  '/api/unit-shifts',
  '/api/unitshifts',
  '/api/shift-units',
  '/api/shiftunits',
  '/api/shifts',
  '/api/crew-assignments',
  '/api/crewassignments',
  '/api/crews',
  '/api/status-board',
  '/api/statusboard'
];
const LINKAGE_RESOURCE_CANDIDATES = [
  '/api/unit-call-sign',
  '/api/unit-call-sign-history',
  '/api/unit-call-sign-histories',
  '/api/unit-call-sign-assignments',
  '/api/unit-call-sign-links',
  '/api/unit-call-sign-records',
  '/api/unit-call-sign-logs',
  '/api/call-sign-assignments',
  '/api/call-sign-history',
  '/api/call-sign-histories',
  '/api/call-sign-units',
  '/api/truck-call-signs',
  '/api/truckcallsigns',
  '/api/truck-call-sign-assignments',
  '/api/truckcallsignassignments',
  '/api/truck-call-sign-history',
  '/api/truckcallsignhistory',
  '/api/call-sign-trucks',
  '/api/truck-assignments',
  '/api/truckassignments',
  '/api/unit-history',
  '/api/unit-histories',
  '/api/unit-logs',
  '/api/unit-activities',
  '/api/truck-history',
  '/api/truck-histories',
  '/api/truck-logs',
  '/api/truck-activities',
  '/api/unit-status-history',
  '/api/unit-status-histories',
  '/api/reports/unit-call-signs',
  '/api/unit-call-signs-report'
];
const INCOMPLETE_CHECK_PATTERN = /inspection|questionnaire|check.?list|check|completion|complete|front.?line|schedule/i;
const SERVICE_TICKET_PATTERN = /service.?desk|service.?ticket|support.?ticket|help.?desk|ticket|support.?request|repair.?request/i;
const SERVICE_TICKET_RESOURCE_CANDIDATES = [
  '/api/desk-tickets',
  '/api/desktickets',
  '/api/ems-desk-tickets',
  '/api/emsdesktickets',
  '/api/service-tickets',
  '/api/servicetickets',
  '/api/service-desk-tickets',
  '/api/servicedesktickets',
  '/api/tickets',
  '/api/support-tickets',
  '/api/supporttickets',
  '/api/help-desk-tickets',
  '/api/helpdesktickets',
  '/api/service-requests',
  '/api/servicerequests'
];
const DEFAULT_OPERATIONAL_CHECK_PATTERN = '^(?:Medic\\s+Unit\\s+Daily|Daily\\s+Ladder\\s+Truck\\s+Inspection|Daily\\s+Engine|Admin\\s+Battalion\\s+Daily|UTV.*Check\\s*List)$';
const INCOMPLETE_ASSIGNMENT_RESOURCE_CANDIDATES = [
  '/api/vh-questionary-trucks',
  '/api/vh-questionaries-trucks',
  '/api/vh-questionary-units',
  '/api/vh-questionaries-units',
  '/api/vh-questionary-assets',
  '/api/vh-questionaries-assets',
  '/api/vh-questionary-asset-classes',
  '/api/vh-questionaries-asset-classes',
  '/api/questionary-trucks',
  '/api/questionaries-trucks',
  '/api/questionary-units',
  '/api/questionaries-units',
  '/api/questionary-assets',
  '/api/questionaries-assets',
  '/api/unit-questionaries',
  '/api/truck-questionaries',
  '/api/vehicle-questionaries',
  '/api/vehicle-questionnaires',
  '/api/unit-questionnaires',
  '/api/truck-questionnaires',
  '/api/vh-questionaries',
  '/api/daily-shift-questionaries-state',
  '/api/vh-answers'
];
const SHEET_HEADERS = [
  'Date', 'Location Name', 'Unit Number', 'In-Service Status',
  'Questionnaire Name', 'Status'
];
const SERVICE_TICKET_SHEET_HEADERS = [
  'Created', 'Asset Description', 'Ticket Name',
  'Unit Name', 'Description', 'Status'
];

let cachedToken = null;
let cachedTokenExpiresAt = 0;
let cachedGoogleToken = null;
let cachedGoogleTokenExpiresAt = 0;
let cachedTurnoutPreview = null;
let cachedTurnoutPreviewExpiresAt = 0;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (!authorized(request, env)) {
      return json({ error: 'Unauthorized' }, 401);
    }

    try {
      if (url.pathname === '/inspect') {
        return json(await inspectSwagger(
          env,
          url.searchParams.get('q') || '',
          url.searchParams.get('compact') === '1'
        ));
      }

      if (url.pathname === '/inspect-models') {
        return json(await inspectModels(env, url.searchParams.get('q') || ''));
      }

      if (url.pathname === '/probe-open-service-tickets') {
        return json(await probeOpenServiceTickets(env));
      }

      if (url.pathname === '/probe-service-ticket-linkage') {
        return json(await probeServiceTicketLinkage(
          env,
          validatedPositiveIntegerParameter(url.searchParams.get('ticketId'), 'ticketId')
        ));
      }

      if (
        url.pathname === '/open-service-tickets' ||
        url.pathname === '/preview-open-service-tickets'
      ) {
        return json(await previewOpenServiceTickets(env));
      }

      if (url.pathname === '/export-open-service-tickets') {
        if (!normalizeBoolean(env.OPEN_SERVICE_TICKETS_SHEETS_EXPORT_ENABLED)) {
          return json({
            error: 'Open-service-ticket Google Sheets export is disabled.',
            requiredSetting: 'OPEN_SERVICE_TICKETS_SHEETS_EXPORT_ENABLED=true'
          }, 409);
        }
        return json(await exportOpenServiceTicketsToSheets(env));
      }

      if (url.pathname === '/inspect-incomplete-checks') {
        return json(await inspectIncompleteChecks(env));
      }

      if (url.pathname === '/probe-incomplete-checks') {
        return json(await probeIncompleteChecks(env));
      }

      if (url.pathname === '/probe-incomplete-assignment-sources') {
        return json(await probeIncompleteAssignmentSources(env));
      }

      if (url.pathname === '/probe-operational-question-linkage') {
        return json(await probeOperationalQuestionLinkage(
          env,
          validatedInstantParameter(url.searchParams.get('at'))
        ));
      }

      if (url.pathname === '/probe-turnout-gear') {
        return json(await probeTurnoutGear(env));
      }

      if (url.pathname === '/preview-turnout-gear') {
        return json(await previewTurnoutGear(
          env,
          validatedInstantParameter(url.searchParams.get('at'))
        ));
      }

      if (url.pathname === '/probe-supply-inventory') {
        return json(await probeSupplyInventory(env));
      }

      if (url.pathname === '/preview-supply-inventory') {
        return json(await previewSupplyInventory(env));
      }

      if (url.pathname === '/debug/supply') {
        return json(await debugSupplyInventory(
          env,
          url.searchParams.get('search') || ''
        ));
      }

      if (url.pathname === '/debug/turnout-asset') {
        return json(await debugTurnoutAsset(
          env,
          url.searchParams.get('search') || ''
        ));
      }

      if (url.pathname === '/preview-physical-due') {
        return json(await previewPhysicalDue(
          env,
          validatedInstantParameter(url.searchParams.get('at'))
        ));
      }

      if (url.pathname === '/preview-crew-emails') {
        return json(await previewCrewEmails(env));
      }

      if (url.pathname === '/preview-inferred-operational-checks') {
        return json(await previewInferredOperationalChecks(
          env,
          validatedInstantParameter(url.searchParams.get('at'))
        ));
      }

      if (url.pathname === '/preview-incomplete-checks') {
        return json(await previewIncompleteChecks(
          env,
          validatedDateParameter(url.searchParams.get('date')),
          url.searchParams.get('compact') === '1'
        ));
      }

      if (url.pathname === '/preview-current-incomplete-checks') {
        return json(await previewCurrentIncompleteChecks(
          env,
          validatedInstantParameter(url.searchParams.get('at'))
        ));
      }

      if (url.pathname === '/sync-incomplete-checks') {
        if (!normalizeBoolean(env.INCOMPLETE_CHECKS_D1_ENABLED)) {
          return json({
            error: 'Incomplete-check D1 writes are disabled.',
            requiredSetting: 'INCOMPLETE_CHECKS_D1_ENABLED=true'
          }, 409);
        }
        return json(await syncIncompleteChecks(env));
      }

      if (url.pathname === '/export-incomplete-checks') {
        if (!normalizeBoolean(env.GOOGLE_SHEETS_EXPORT_ENABLED)) {
          return json({
            error: 'Google Sheets export is disabled.',
            requiredSetting: 'GOOGLE_SHEETS_EXPORT_ENABLED=true'
          }, 409);
        }
        return json(await exportIncompleteChecksToSheets(env));
      }

      if (url.pathname === '/preview') {
        const endpoint = validatedApiPath(
          url.searchParams.get('path') || env.OPERATIVE_ASSIGNMENTS_PATH
        );
        return json(await previewAssignments(env, endpoint));
      }

      if (url.pathname === '/preview-live-assignments') {
        return json(await previewLiveAssignments(env));
      }

      if (url.pathname === '/sync-live-assignments') {
        if (!normalizeBoolean(env.OPERATIVE_APPLY_ENABLED)) {
          return json({
            error: 'OperativeIQ assignment writes are disabled.',
            requiredSetting: 'OPERATIVE_APPLY_ENABLED=true'
          }, 409);
        }
        return json(await applyLiveAssignments(env));
      }

      if (url.pathname === '/probe') {
        return json(await probeAssignmentResources(env));
      }

      if (url.pathname === '/probe-linkage') {
        return json(await probeLinkageResources(env));
      }

      return json({
        error: 'Not found',
        routes: [
          '/inspect',
          '/inspect-models?q=call',
          '/probe-open-service-tickets',
          '/probe-service-ticket-linkage?ticketId=331',
          '/open-service-tickets',
          '/preview-open-service-tickets',
          '/export-open-service-tickets',
          '/inspect-incomplete-checks',
          '/probe-incomplete-checks',
          '/probe-incomplete-assignment-sources',
          '/probe-operational-question-linkage?at=ISO_TIMESTAMP',
          '/probe-turnout-gear',
          '/preview-turnout-gear?at=ISO_TIMESTAMP',
          '/probe-supply-inventory',
          '/preview-supply-inventory',
          '/debug/supply',
          '/debug/turnout-asset?search=Coat-26',
          '/preview-physical-due?at=ISO_TIMESTAMP',
          '/preview-crew-emails',
          '/preview-inferred-operational-checks?at=ISO_TIMESTAMP',
          '/preview-incomplete-checks?date=YYYY-MM-DD&compact=1',
          '/preview-current-incomplete-checks?at=ISO_TIMESTAMP',
          '/sync-incomplete-checks',
          '/export-incomplete-checks',
          '/probe',
          '/probe-linkage',
          '/preview?path=/api/...',
          '/preview-live-assignments',
          '/sync-live-assignments'
        ]
      }, 404);
    } catch (error) {
      return json({ error: errorMessage(error) }, 500);
    }
  },

  async scheduled(controller, env, ctx) {
    const tasks = [];
    const cron = String(controller?.cron || '');

    if (cron === '*/5 * * * *') {
      if (normalizeBoolean(env.OPERATIVE_APPLY_ENABLED)) {
        tasks.push(runScheduledAssignmentSync(env));
      } else {
        console.log('OperativeIQ scheduled assignment sync skipped: OPERATIVE_APPLY_ENABLED is false.');
      }
    }

    if (cron === '*/30 * * * *') {
      if (normalizeBoolean(env.INCOMPLETE_CHECKS_D1_ENABLED)) {
        tasks.push(runScheduledIncompleteCheckSync(env));
      } else {
        console.log('Incomplete-check sync skipped: INCOMPLETE_CHECKS_D1_ENABLED is false.');
      }

      if (normalizeBoolean(env.OPEN_SERVICE_TICKETS_SHEETS_EXPORT_ENABLED)) {
        tasks.push(runScheduledOpenServiceTicketExport(env));
      } else {
        console.log('Open-service-ticket export skipped: OPEN_SERVICE_TICKETS_SHEETS_EXPORT_ENABLED is false.');
      }
    }

    if (tasks.length) ctx.waitUntil(Promise.all(tasks));
  }
};

async function runScheduledAssignmentSync(env) {
  try {
    const result = await applyLiveAssignments(env);
    console.log(JSON.stringify({
      event: 'operative_assignment_sync_completed',
      changedCount: result.changedCount,
      warningCount: result.warnings?.length || 0,
      timestamp: result.timestamp
    }));
  } catch (error) {
    console.error(JSON.stringify({
      event: 'operative_assignment_sync_failed',
      error: errorMessage(error),
      timestamp: new Date().toISOString()
    }));
    throw error;
  }
}

async function runScheduledIncompleteCheckSync(env) {
  try {
    const result = await syncIncompleteChecks(env);
    console.log(JSON.stringify({
      event: 'operative_incomplete_checks_sync_completed',
      shiftKey: result.shiftKey,
      recordCount: result.recordCount,
      sheetsExported: result.sheetsExported,
      timestamp: result.timestamp
    }));
  } catch (error) {
    console.error(JSON.stringify({
      event: 'operative_incomplete_checks_sync_failed',
      error: errorMessage(error),
      timestamp: new Date().toISOString()
    }));
    throw error;
  }
}

async function runScheduledOpenServiceTicketExport(env) {
  try {
    const result = await exportOpenServiceTicketsToSheets(env);
    console.log(JSON.stringify({
      event: 'operative_open_service_tickets_export_completed',
      recordCount: result.rowCount,
      endpoint: result.endpoint,
      timestamp: result.timestamp
    }));
  } catch (error) {
    console.error(JSON.stringify({
      event: 'operative_open_service_tickets_export_failed',
      error: errorMessage(error),
      timestamp: new Date().toISOString()
    }));
    throw error;
  }
}

async function inspectModels(env, searchText) {
  const token = await getAccessToken(env);
  const response = await fetch(RESOURCE_ROOT + '/swagger/v1/swagger.json', {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' }
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`OperativeIQ Swagger request failed (${response.status}): ${safeApiError(text)}`);
  }
  const specification = JSON.parse(text);
  const schemas = specification.components?.schemas || specification.definitions || {};
  const query = String(searchText || '').trim().toLowerCase();
  const models = Object.entries(schemas)
    .map(([name, schema]) => ({
      name,
      properties: Object.keys(schema?.properties || {}),
      required: schema?.required || []
    }))
    .filter(model => !query || JSON.stringify(model).toLowerCase().includes(query));

  return {
    success: true,
    mode: 'READ_ONLY_MODEL_INSPECTION',
    query,
    totalSchemaCount: Object.keys(schemas).length,
    matchCount: models.length,
    models,
    note: 'OpenAPI model names and property names only. No records or D1 data were changed.'
  };
}

async function probeOpenServiceTickets(env) {
  const token = await getAccessToken(env);
  let specification = { paths: {}, components: { schemas: {} } };
  let swaggerPath = '';
  let swaggerError = '';
  try {
    const loaded = await loadSwagger(env, token, false);
    specification = loaded.specification;
    swaggerPath = loaded.swaggerPath;
  } catch (error) {
    swaggerError = errorMessage(error);
  }
  const candidates = serviceTicketResourceCandidates(specification).slice(0, 30);
  const results = [];

  for (let offset = 0; offset < candidates.length; offset += 6) {
    const batch = candidates.slice(offset, offset + 6);
    results.push(...await Promise.all(batch.map(path => probeReadOnlyResource(path, token))));
  }

  const ranked = results
    .map(result => ({ ...result, ticketFieldScore: serviceTicketProbeScore(result) }))
    .sort((a, b) =>
      b.ticketFieldScore - a.ticketFieldScore ||
      Number(b.returnedCount || 0) - Number(a.returnedCount || 0) ||
      a.path.localeCompare(b.path)
    );

  return {
    success: true,
    mode: 'READ_ONLY_OPEN_SERVICE_TICKET_PROBE',
    swaggerPath,
    swaggerAvailable: Boolean(swaggerPath),
    swaggerError,
    testedCount: ranked.length,
    availableResources: ranked.filter(result => result.status !== 404),
    recommendedResource: ranked.find(result => result.status >= 200 && result.status < 300 && result.ticketFieldScore >= 4) || null,
    results: ranked,
    note: 'GET-only probes with $top=1. Swagger is optional. No OperativeIQ, D1, Gmail, or Google Sheets data was changed.'
  };
}

async function probeServiceTicketLinkage(env, ticketId) {
  const token = await getAccessToken(env);
  const encodedId = encodeURIComponent(String(ticketId));
  const candidates = [
    '/api/service-desk-ticket-statuses',
    '/api/desk-ticket-statuses',
    '/api/desk-ticket-status',
    '/api/desk-ticket-status-meanings',
    `/api/service-desk-tickets/${encodedId}`,
    `/api/service-desk-tickets/${encodedId}/assigned-items`,
    `/api/service-desk-tickets/${encodedId}/items`,
    `/api/service-desk-ticket/${encodedId}`,
    `/api/desk-tickets/${encodedId}`,
    `/api/service-desk-ticket-items?ticketId=${encodedId}`,
    `/api/desk-ticket-items?ticketId=${encodedId}`,
    `/api/desk-ticket-items?$filter=${encodeURIComponent(`ticketId eq ${ticketId}`)}`
  ];
  const results = [];
  for (let offset = 0; offset < candidates.length; offset += 6) {
    const batch = candidates.slice(offset, offset + 6);
    results.push(...await Promise.all(batch.map(path => probeServiceTicketLinkagePath(path, token))));
  }

  return {
    success: true,
    mode: 'READ_ONLY_SERVICE_TICKET_LINKAGE_PROBE',
    ticketId,
    availableResources: results.filter(result => result.status !== 404),
    results,
    note: 'GET-only ticket detail, assigned-item, item-link, and status probes. No OperativeIQ, D1, Gmail, or Google Sheets data was changed.'
  };
}

async function probeServiceTicketLinkagePath(path, token) {
  const url = new URL(RESOURCE_ROOT + path);
  if (!url.pathname.match(/\/\d+(?:\/|$)/)) {
    if (!url.searchParams.has('$top')) url.searchParams.set('$top', '20');
    if (!url.searchParams.has('$skip')) url.searchParams.set('$skip', '0');
  }
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' }
  });
  const text = await response.text();
  const result = {
    path,
    status: response.status,
    overallCount: numericHeader(response.headers.get('X-Overall-Count'))
  };
  if (!response.ok) {
    result.error = safeApiError(text);
    return result;
  }
  try {
    const payload = JSON.parse(text);
    const records = Array.isArray(payload)
      ? payload
      : ['value', 'data', 'results', 'items'].find(key => Array.isArray(payload?.[key]))
        ? arrayPayload(payload)
        : [payload];
    result.returnedCount = records.length;
    result.fields = Object.keys(records[0] || {});
    result.sample = summarizeServiceTicketLinkageValue(records[0] || {}, '', 0);
  } catch (error) {
    result.parseError = errorMessage(error);
  }
  return result;
}

function summarizeServiceTicketLinkageValue(value, key, depth) {
  if (value === null || value === undefined) return value;
  if (/description|body|email|comment|response/i.test(key)) return '[REDACTED_TEXT]';
  if (Array.isArray(value)) {
    if (value.every(item => ['string', 'number', 'boolean'].includes(typeof item))) {
      return value.slice(0, 50);
    }
    return value.slice(0, 5).map(item => summarizeServiceTicketLinkageValue(item, key, depth + 1));
  }
  if (typeof value !== 'object') return value;
  if (depth >= 2) return `[Object fields: ${Object.keys(value).join(', ')}]`;
  const result = {};
  for (const [childKey, childValue] of Object.entries(value)) {
    if (
      depth === 0 ||
      /id|status|closed|name|number|item|truck|unit|location|facility|category/i.test(childKey)
    ) {
      result[childKey] = summarizeServiceTicketLinkageValue(childValue, childKey, depth + 1);
    }
  }
  return result;
}

async function previewOpenServiceTickets(env) {
  const token = await getAccessToken(env);
  const resolved = await resolveServiceTicketResource(env, token);
  const [sourceRecords, statuses, units, locations] = await Promise.all([
    fetchAll(resolved.path, token, 5000),
    fetchAll('/api/service-desk-ticket-statuses', token, 100),
    fetchAll('/api/units', token, 500),
    fetchAll('/api/unit-locations', token, 500)
  ]);
  const statusById = new Map(statuses.map(status => [
    String(status.id),
    String(status.statusName || status.name || '').trim()
  ]));
  const unitsById = new Map(units.map(unit => [String(unit.id), unit]));
  const locationsById = new Map();
  for (const location of locations) {
    for (const key of [location.id, location.roomId]) {
      if (key !== null && key !== undefined && key !== '') {
        locationsById.set(String(key), location);
      }
    }
  }
  const requiredStatus = normalize(env.OPEN_SERVICE_TICKET_STATUS_NAME || 'Open');
  const selected = new Map();
  const openTickets = [];

  for (const source of sourceRecords) {
    const row = normalizeServiceTicket(source);
    const mappedStatus = statusById.get(String(row.statusId)) || row.status;
    if (row.isClosed || normalize(mappedStatus) !== requiredStatus) continue;
    row.status = mappedStatus || 'Open';
    row.unitName = row.unitName || serviceTicketUnitName(row, unitsById, locationsById);
    openTickets.push(row);
  }

  const itemResults = [];
  for (let offset = 0; offset < openTickets.length; offset += 6) {
    const batch = openTickets.slice(offset, offset + 6);
    itemResults.push(...await Promise.all(batch.map(async row => ({
      row,
      items: await fetchServiceTicketAssignedItems(row.ticketId, token)
    }))));
  }

  for (const { row, items } of itemResults) {
    const assignedItems = items.length ? items : [null];
    for (const item of assignedItems) {
      const expanded = {
        ...row,
        assetDescription: serviceTicketAssignedItemName(item) ||
          row.assetDescription || row.unitName
      };
      const key = [expanded.ticketId, expanded.assetDescription].join('|');
      if (!selected.has(key)) selected.set(key, expanded);
    }
  }

  const rows = [...selected.values()].sort((a, b) =>
    a.createdMillis - b.createdMillis ||
    a.ticketName.localeCompare(b.ticketName) ||
    a.unitName.localeCompare(b.unitName)
  ).map(({ createdMillis, isClosed, statusId, truckId, locationId, ...row }) => row);

  return {
    success: true,
    mode: 'READ_ONLY_OPEN_SERVICE_TICKETS',
    endpoint: resolved.path,
    endpointSource: resolved.source,
    sourceRecordCount: sourceRecords.length,
    openTicketCount: openTickets.length,
    recordCount: rows.length,
    headers: SERVICE_TICKET_SHEET_HEADERS,
    rows,
    detectedSourceFields: resolved.fields,
    timestamp: new Date().toISOString(),
    note: 'Open Service Desk tickets only. No OperativeIQ, D1, Gmail, or Google Sheets data was changed.'
  };
}

async function fetchServiceTicketAssignedItems(ticketId, token) {
  if (!String(ticketId || '').trim()) return [];
  const path = `/api/service-desk-tickets/${encodeURIComponent(String(ticketId))}/assigned-items`;
  const response = await fetch(RESOURCE_ROOT + path, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' }
  });
  const text = await response.text();
  if (response.status === 404) return [];
  if (!response.ok) {
    throw new Error(`OperativeIQ assigned-items request failed (${response.status}) for ticket ${ticketId}: ${safeApiError(text)}`);
  }
  const items = arrayPayload(JSON.parse(text));
  if (items.length > 1000) {
    throw new Error(`OperativeIQ returned more than 1,000 assigned items for ticket ${ticketId}.`);
  }
  return items;
}

function serviceTicketAssignedItemName(item) {
  if (!item || typeof item !== 'object') return '';
  return serviceTicketText(
    item.itemName || item.assetDescription || item.itemDescription ||
    item.assetName || item.name || ''
  );
}

function serviceTicketUnitName(row, unitsById, locationsById) {
  const unit = unitsById.get(String(row.truckId)) || {};
  const truckNumber = serviceTicketText(
    unit.truckNumber || unit.unitNumber || unit.name || ''
  );
  if (truckNumber) {
    if (/^Vehicle\s+/i.test(truckNumber)) return truckNumber;
    if (/^F\d+[A-Z0-9-]*$/i.test(truckNumber)) return `Vehicle ${truckNumber}`;
    return truckNumber;
  }

  const location = locationsById.get(String(row.locationId)) || {};
  return serviceTicketText(
    location.locationName || location.locationDescription || location.name || ''
  );
}

async function resolveServiceTicketResource(env, token) {
  const configured = String(env.OPERATIVE_SERVICE_TICKETS_PATH || '').trim();
  if (configured) {
    const path = validatedApiPath(configured);
    const result = await probeReadOnlyResource(path, token);
    if (result.status < 200 || result.status >= 300) {
      throw new Error(`Configured service-ticket resource failed (${result.status}): ${result.error || path}`);
    }
    if (serviceTicketProbeScore(result) < 4) {
      throw new Error(`Configured service-ticket resource does not expose the expected ticket fields: ${path}`);
    }
    return { path, source: 'OPERATIVE_SERVICE_TICKETS_PATH', fields: result.fields || [] };
  }

  const probe = await probeOpenServiceTickets(env);
  const selected = probe.recommendedResource;
  if (!selected) {
    throw new Error('No readable OperativeIQ Service Desk ticket resource was identified. Run /probe-open-service-tickets and set OPERATIVE_SERVICE_TICKETS_PATH to the verified resource.');
  }
  return { path: selected.path, source: 'SWAGGER_AUTO_DISCOVERY', fields: selected.fields || [] };
}

function serviceTicketResourceCandidates(specification) {
  const result = new Set(SERVICE_TICKET_RESOURCE_CANDIDATES);
  for (const [apiPath, methods] of Object.entries(specification?.paths || {})) {
    if (apiPath.includes('{')) continue;
    const getOperation = Object.entries(methods || {})
      .find(([method]) => method.toLowerCase() === 'get')?.[1];
    if (!getOperation) continue;
    if (SERVICE_TICKET_PATTERN.test(JSON.stringify({ apiPath, getOperation }))) {
      result.add(apiPath);
    }
  }

  const schemas = specification?.components?.schemas || specification?.definitions || {};
  for (const [name, schema] of Object.entries(schemas)) {
    if (!SERVICE_TICKET_PATTERN.test(JSON.stringify({ name, schema }))) continue;
    for (const path of modelApiResourceCandidates(name)) result.add(path);
  }
  return [...result].filter(path => path.startsWith('/api/'));
}

function serviceTicketProbeScore(result) {
  if (result.status < 200 || result.status >= 300 || result.parseError) return -1;
  const fields = (result.fields || []).map(normalizeServiceTicketKey);
  let score = SERVICE_TICKET_PATTERN.test(result.path || '') ? 2 : 0;
  if (fields.some(value => /ticketname|subject|title|requestname/.test(value))) score += 2;
  if (fields.some(value => /description|details|issue/.test(value))) score += 2;
  if (fields.some(value => /status/.test(value))) score += 1;
  if (fields.some(value => /created|opened|submitted|entrydate/.test(value))) score += 1;
  if (fields.some(value => /asset|unit|truck|vehicle|location/.test(value))) score += 1;
  if (fields.some(value => /ticketid|serviceticketid/.test(value))) score += 1;
  return score;
}

function normalizeServiceTicket(source) {
  const fields = flattenServiceTicketFields(source);
  const createdValue = serviceTicketValue(fields, [
    'createdDateTime', 'createdDate', 'createdTime', 'dateCreated',
    'createdOn', 'openedDate', 'submittedDate', 'entryDate', 'date'
  ]);
  const status = serviceTicketValue(fields, [
    'statusName', 'ticketStatusName', 'serviceTicketStatusName',
    'ticketStatus', 'serviceTicketStatus', 'currentStatus', 'status.name', 'status'
  ]);
  const isClosed = serviceTicketValue(fields, ['isClosed', 'closed']);
  return {
    ticketId: serviceTicketValue(fields, ['ticketId', 'serviceTicketId', 'serviceDeskTicketId', 'id']),
    statusId: serviceTicketValue(fields, ['statusId', 'ticketStatusId', 'status']),
    truckId: serviceTicketValue(fields, ['truckId', 'unitId']),
    locationId: serviceTicketValue(fields, ['locationId', 'unitLocationId']),
    created: serviceTicketDisplayDate(createdValue),
    assetDescription: serviceTicketValue(fields, [
      'assetDescription', 'assetName', 'fixedAssetDescription',
      'asset.description', 'asset.name', 'itemDescription'
    ]),
    ticketName: serviceTicketValue(fields, [
      'ticketName', 'serviceTicketName', 'requestName', 'subject', 'title', 'name'
    ]),
    unitName: serviceTicketValue(fields, [
      'unitName', 'truckName', 'vehicleName', 'unitDescription',
      'unit.unitName', 'unit.truckNumber', 'truck.truckNumber', 'vehicle.name',
      'locationName'
    ]),
    description: serviceTicketValue(fields, [
      'ticketDescription', 'serviceTicketDescription', 'issueDescription',
      'requestDescription', 'description', 'details'
    ]),
    status: status || 'Open',
    isClosed: normalizeBoolean(isClosed),
    createdMillis: serviceTicketDateMillis(createdValue)
  };
}

function flattenServiceTicketFields(source) {
  const result = new Map();
  const visit = (value, path, depth) => {
    if (value === null || value === undefined || depth > 2) return;
    if (Array.isArray(value)) return;
    if (typeof value !== 'object') {
      const text = String(value).trim();
      if (!text) return;
      const fullKey = normalizeServiceTicketKey(path.join('.'));
      const leafKey = normalizeServiceTicketKey(path[path.length - 1]);
      if (fullKey && !result.has(fullKey)) result.set(fullKey, text);
      if (leafKey && !result.has(leafKey)) result.set(leafKey, text);
      return;
    }
    for (const [key, child] of Object.entries(value)) visit(child, [...path, key], depth + 1);
  };
  visit(source || {}, [], 0);
  return result;
}

function serviceTicketValue(fields, names) {
  for (const name of names) {
    const value = fields.get(normalizeServiceTicketKey(name));
    if (value !== undefined && value !== null && serviceTicketText(value)) {
      return serviceTicketText(value);
    }
  }
  return '';
}

function serviceTicketText(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function normalizeServiceTicketKey(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function isOpenServiceTicket(value) {
  const status = normalize(value);
  return !/(?:CLOSED|RESOLVED|COMPLETED|COMPLETE|CANCELLED|CANCELED|VOID|DELETED)/.test(status);
}

function serviceTicketDateMillis(value) {
  const numeric = Number(value);
  if (Number.isFinite(numeric) && numeric > 20000 && numeric < 60000) {
    return Date.UTC(1899, 11, 30) + numeric * 86400000;
  }
  const millis = new Date(String(value || '')).getTime();
  return Number.isFinite(millis) ? millis : 0;
}

function serviceTicketDisplayDate(value) {
  const text = String(value || '').trim();
  const dateOnly = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (dateOnly) return `${dateOnly[2]}/${dateOnly[3]}/${dateOnly[1]}`;
  const millis = serviceTicketDateMillis(value);
  if (!millis) return text;
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York', month: '2-digit', day: '2-digit', year: 'numeric'
  }).format(new Date(millis));
}

async function inspectIncompleteChecks(env) {
  const { specification, swaggerPath } = await loadSwagger(env, null, false);
  const schemas = specification.components?.schemas || specification.definitions || {};
  const paths = Object.entries(specification.paths || {})
    .map(([apiPath, methods]) => ({
      path: apiPath,
      operations: Object.entries(methods || {})
        .filter(([method]) => /^(get|post)$/i.test(method))
        .map(([method, operation]) => ({
          method: method.toUpperCase(),
          operationId: operation?.operationId || '',
          summary: operation?.summary || '',
          tags: operation?.tags || [],
          responseModels: responseModelNames(operation)
        }))
    }))
    .filter(item => INCOMPLETE_CHECK_PATTERN.test(JSON.stringify(item)));
  const models = Object.entries(schemas)
    .map(([name, schema]) => ({
      name,
      properties: Object.keys(schema?.properties || {}),
      required: schema?.required || []
    }))
    .filter(model => INCOMPLETE_CHECK_PATTERN.test(JSON.stringify(model)));

  return {
    success: true,
    mode: 'READ_ONLY_INCOMPLETE_CHECK_DISCOVERY',
    swaggerPath,
    pathCount: paths.length,
    modelCount: models.length,
    paths,
    models,
    csvTarget: {
      columns: [
        'Date', 'Location Name', 'Unit Number', 'In-Service Status',
        'Questionnaire Name', 'Status'
      ],
      targetStatus: 'Not Completed'
    },
    note: 'OpenAPI metadata only. No OperativeIQ records or D1 data were changed.'
  };
}

async function probeIncompleteChecks(env) {
  const token = await getAccessToken(env);
  const { specification, swaggerPath } = await loadSwagger(env, token);
  const candidates = Object.entries(specification.paths || {})
    .flatMap(([apiPath, methods]) => Object.entries(methods || {})
      .filter(([method, operation]) =>
        method.toLowerCase() === 'get' &&
        !apiPath.includes('{') &&
        INCOMPLETE_CHECK_PATTERN.test(JSON.stringify({ apiPath, operation }))
      )
      .map(([_method, operation]) => ({
        path: apiPath,
        operationId: operation?.operationId || '',
        summary: operation?.summary || '',
        tags: operation?.tags || []
      })))
    .slice(0, 30);
  const results = [];

  for (const candidate of candidates) {
    const url = new URL(RESOURCE_ROOT + candidate.path);
    url.searchParams.set('$top', '1');
    url.searchParams.set('$skip', '0');
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' }
    });
    const text = await response.text();
    const result = {
      ...candidate,
      status: response.status,
      overallCount: numericHeader(response.headers.get('X-Overall-Count'))
    };
    if (response.ok) {
      try {
        const records = arrayPayload(JSON.parse(text));
        result.returnedCount = records.length;
        result.fields = Object.keys(records[0] || {});
        result.sample = redactDiscoverySample(records[0] || {});
      } catch (error) {
        result.parseError = errorMessage(error);
      }
    } else {
      result.error = safeApiError(text);
    }
    results.push(result);
  }

  return {
    success: true,
    mode: 'READ_ONLY_INCOMPLETE_CHECK_PROBE',
    swaggerPath,
    testedCount: results.length,
    availableResources: results.filter(item => item.status !== 404),
    results,
    note: 'GET-only metadata probes with $top=1. No OperativeIQ records or D1 data were changed.'
  };
}

async function probeIncompleteAssignmentSources(env) {
  const token = await getAccessToken(env);
  const { specification, swaggerPath } = await loadSwagger(env, token, false);
  const schemas = specification.components?.schemas || specification.definitions || {};
  const candidateModels = Object.entries(schemas)
    .map(([name, schema]) => ({
      name,
      properties: Object.keys(schema?.properties || {}),
      required: schema?.required || []
    }))
    .filter(model => {
      const text = JSON.stringify(model).toLowerCase();
      const checkRelated = /question|inspection|schedule/.test(text);
      const assignmentRelated = /unit|truck|vehicle|asset|class|shift|location/.test(text);
      return checkRelated && assignmentRelated;
    });

  const resourceCandidates = new Set(INCOMPLETE_ASSIGNMENT_RESOURCE_CANDIDATES);
  for (const model of candidateModels) {
    for (const path of modelApiResourceCandidates(model.name)) {
      resourceCandidates.add(path);
    }
  }

  // Auth + Swagger consume two Worker subrequests. Keep this bounded below the
  // Cloudflare free-plan 50-subrequest ceiling.
  const paths = [...resourceCandidates].slice(0, 45);
  const results = [];
  for (let offset = 0; offset < paths.length; offset += 8) {
    const batch = paths.slice(offset, offset + 8);
    results.push(...await Promise.all(batch.map(path => probeReadOnlyResource(path, token))));
  }

  const statusCounts = {};
  for (const result of results) {
    const key = String(result.status);
    statusCounts[key] = (statusCounts[key] || 0) + 1;
  }

  return {
    success: true,
    mode: 'READ_ONLY_INCOMPLETE_ASSIGNMENT_SOURCE_PROBE',
    swaggerPath,
    candidateModelCount: candidateModels.length,
    candidateModels,
    testedResourceCount: results.length,
    statusCounts,
    availableResources: results.filter(item => item.status !== 404),
    results,
    findingNeeded: 'A resource that enumerates due unit/questionnaire assignments even when no state or answer exists.',
    note: 'GET-only probes with $top=1. No OperativeIQ, D1, or Google Sheets data was changed.'
  };
}

async function probeTurnoutGear(env) {
  const token = await getAccessToken(env);
  const [items, fixedAssets] = await Promise.all([
    fetchAll('/api/items', token, 5000),
    fetchAll('/api/fixed-assets', token, 5000)
  ]);

  const itemIdValue = source => source?.id ?? source?.itemId ?? source?.itemID ?? null;
  const fixedItemIdValue = source => source?.itemId ?? source?.itemID ?? source?.id ?? null;
  const textValue = (source, keys) => {
    for (const key of keys) {
      const value = source?.[key];
      if (value !== null && value !== undefined && String(value).trim()) return String(value).trim();
    }
    return '';
  };
  const gearPattern = /\b(coat|pant|turnout|bunker|fire\s*gear|helmet|hood|boot|glove)\b/i;
  const fixedAssetsByItem = new Map();

  for (const record of fixedAssets) {
    const itemId = fixedItemIdValue(record);
    if (itemId === null || itemId === undefined || itemId === '') continue;
    const key = String(itemId);
    if (!fixedAssetsByItem.has(key)) fixedAssetsByItem.set(key, []);
    fixedAssetsByItem.get(key).push(record);
  }

  const gearItems = items.filter(item => gearPattern.test([
    item?.itemName,
    item?.itemNumber,
    item?.partUpc,
    item?.assetDescription,
    item?.internalPartNumber,
    item?.modelNumber
  ].filter(Boolean).join(' ')));

  const candidates = gearItems.slice(0, 40).map(item => {
    const itemId = itemIdValue(item);
    const maintenance = fixedAssetsByItem.get(String(itemId)) || [];
    maintenance.sort((a, b) => String(
      b?.performPreventativeMaintenanceEnterDate || b?.createdDate || b?.createdTime || ''
    ).localeCompare(String(
      a?.performPreventativeMaintenanceEnterDate || a?.createdDate || a?.createdTime || ''
    )));
    const latest = maintenance[0] || {};

    return {
      itemId,
      itemName: textValue(item, ['itemName', 'name']),
      itemNumber: textValue(item, ['itemNumber', 'internalPartNumber']),
      partUpc: textValue(item, ['partUpc', 'partUPC', 'barCodeNumber']),
      assetDescription: textValue(item, ['assetDescription', 'description']),
      assetClassId: item?.assetClassId ?? null,
      preventativeMaintenance: item?.preventativeMaintenance ?? null,
      preventativeMaintenanceFrequency: item?.preventativeMaintenanceFrequency ?? null,
      preventativeMaintenanceNextPmdate: item?.preventativeMaintenanceNextPmdate ?? null,
      preventativeMaintenanceHistoryPmdate: item?.preventativeMaintenanceHistoryPmdate ?? null,
      fixedAssetRecordCount: maintenance.length,
      latestMaintenanceDate: latest?.performPreventativeMaintenanceEnterDate || latest?.createdDate || null,
      latestMaintenanceType: latest?.type ?? null,
      latestMaintenanceStatusId: latest?.statusId ?? null
    };
  });

  const sampleItemId = candidates.find(item => item.itemId !== null)?.itemId
    ?? fixedAssets.map(fixedItemIdValue).find(value => value !== null && value !== undefined && value !== '')
    ?? items.map(itemIdValue).find(value => value !== null && value !== undefined && value !== '');
  const assignmentProbes = [];

  if (sampleItemId !== null && sampleItemId !== undefined && sampleItemId !== '') {
    const id = encodeURIComponent(String(sampleItemId));
    const paths = [
      `/api/items/${id}`,
      `/api/items/${id}/checked-out`,
      `/api/items/${id}/checked-out-assets`,
      `/api/items/${id}/checkout`,
      `/api/items/${id}/location`,
      `/api/items/${id}/locations`,
      `/api/fixed-assets/${id}`,
      `/api/fixed-assets/${id}/checked-out`,
      `/api/item-locations?$filter=itemId eq ${id}&$top=5`,
      `/api/item-location?$filter=itemId eq ${id}&$top=5`,
      `/api/checkouts?$filter=itemId eq ${id}&$top=5`,
      `/api/checkout?$filter=itemId eq ${id}&$top=5`
    ];

    for (const path of paths) {
      const response = await fetch(RESOURCE_ROOT + path, {
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' }
      });
      const text = await response.text();
      const probe = { path, status: response.status };
      if (response.ok) {
        try {
          const payload = JSON.parse(text);
          const records = Array.isArray(payload)
            ? payload
            : arrayPayload(payload);
          probe.returnedCount = records.length;
          probe.fields = Object.keys(records[0] || {});
          probe.sample = redactDiscoverySample(records[0] || {});
        } catch (_error) {
          try {
            const payload = JSON.parse(text);
            probe.fields = Object.keys(payload || {});
            probe.sample = redactDiscoverySample(payload || {});
          } catch (error) {
            probe.parseError = errorMessage(error);
          }
        }
      } else {
        probe.error = safeApiError(text);
      }
      assignmentProbes.push(probe);
    }
  }

  return {
    success: true,
    mode: 'READ_ONLY_TURNOUT_GEAR_PROBE',
    sourceCounts: {
      items: items.length,
      fixedAssets: fixedAssets.length,
      gearItems: gearItems.length
    },
    itemFields: Object.keys(items[0] || {}).filter(key =>
      /id|item|part|asset|preventative|service|location|crew|assign|issue|status/i.test(key)
    ),
    fixedAssetFields: Object.keys(fixedAssets[0] || {}),
    sampleItemId: sampleItemId ?? null,
    candidates,
    assignmentProbes,
    note: 'Read-only item, fixed-asset, and assignment-route inspection. No OperativeIQ, D1, Gmail, or Google Sheets data was changed.'
  };
}


const SUPPLY_INVENTORY_RESOURCE_CANDIDATES = [
  '/api/supply-rooms/room-parts-for-cycle-counting',
  '/api/item-rooms',
  '/api/item-room-batches',
  '/api/items',
  '/api/supply-rooms',
  '/api/stock-locations',
  '/api/categories',
  '/api/sub-categories',
  '/api/manufacturers',
  '/api/uoms'
];

const DEFAULT_SUPPLY_EXCLUDE_PATTERN = '\\btool\\b|holder|display|sample|test|training|inspection|form|repair|service|cleaner|detergent';

function compilePattern(value, fallback) {
  try { return new RegExp(String(value || fallback), 'i'); }
  catch { return new RegExp(fallback, 'i'); }
}

function supplyEntries(source, depth = 0, prefix = '') {
  if (!source || typeof source !== 'object' || depth > 5) return [];
  const out = [];
  for (const [key, value] of Object.entries(source)) {
    const path = prefix ? `${prefix}.${key}` : key;
    out.push([path, value]);
    if (value && typeof value === 'object' && !Array.isArray(value)) out.push(...supplyEntries(value, depth + 1, path));
  }
  return out;
}

async function fetchAllSafe(endpoint, token, maxRecords = 10000) {
  try {
    return { endpoint, status: 200, rows: await fetchAll(endpoint, token, maxRecords) };
  } catch (error) {
    const message = errorMessage(error);
    const statusMatch = message.match(/\((\d{3})\)/);
    return { endpoint, status: statusMatch ? Number(statusMatch[1]) : 0, rows: [], error: message };
  }
}

function supplyText(source, names) {
  for (const name of names) {
    const value = source?.[name];
    if (value !== null && value !== undefined && String(value).trim()) return String(value).trim();
  }
  const normalizeKey = value => String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const wanted = new Set(names.map(normalizeKey));
  for (const [path, value] of supplyEntries(source || {})) {
    const leaf = path.split('.').at(-1) || path;
    if ((wanted.has(normalizeKey(leaf)) || wanted.has(normalizeKey(path))) && value !== null && value !== undefined && String(value).trim()) return String(value).trim();
  }
  return '';
}

function supplyNumber(source, names) {
  const raw = supplyText(source, names);
  if (!raw) return null;
  const parsed = Number(raw.replace(/[^0-9.-]/g, ''));
  return Number.isFinite(parsed) ? parsed : null;
}

function supplyId(source, names) {
  const value = supplyText(source, names);
  return value ? String(value) : '';
}

function lookupName(map, id, fallback = '') {
  if (!id) return fallback;
  return map.get(String(id)) || fallback;
}

function makeLookup(rows, idNames, nameNames) {
  const map = new Map();
  for (const row of rows || []) {
    const id = supplyId(row, idNames);
    const name = supplyText(row, nameNames);
    if (id && name) map.set(id, name);
  }
  return map;
}

function firstNumeric(source, candidates) {
  for (const names of candidates) {
    const value = supplyNumber(source, names);
    if (value !== null) return value;
  }
  return null;
}

function roomNameFromRow(row, roomLookup) {
  const direct = supplyText(row, ['roomName','supplyRoomName','warehouseName','locationName','room','supplyRoom']);
  if (direct) return direct;
  const id = supplyId(row, ['roomId','roomID','supplyRoomId','supplyRoomID','itemRoomRoomId']);
  return lookupName(roomLookup, id, '');
}

function itemIdFromRow(row) {
  return supplyId(row, ['itemId','itemID','partId','partID','supplyPartId','supplyPartID']);
}

function roomIdFromRow(row) {
  return supplyId(row, ['roomId','roomID','supplyRoomId','supplyRoomID']);
}

function itemRoomIdFromRow(row) {
  return supplyId(row, ['itemRoomId','itemRoomID','roomItemId','roomItemID','id']);
}

function quantityFromInventoryRow(row) {
  return firstNumeric(row, [
    ['quantityOnHand','onHand','onHandQuantity','currentQuantity','quantity','qty','qtyOnHand'],
    ['availableQuantity','availableQty','available','stockQuantity','stockOnHand','currentStock'],
    ['inventoryQuantity','warehouseQuantity','balance','count','batchQuantity','remainingQuantity']
  ]);
}

function normalizeSupplyItem(row, index, lookups) {
  const id = supplyId(row, ['id','itemId','itemID','partId','partID']) || `item-${index+1}`;
  const categoryId = supplyId(row, ['categoryId','categoryID','itemCategoryId']);
  const subcategoryId = supplyId(row, ['subcategoryId','subCategoryId','subCategoryID','itemSubcategoryId']);
  const manufacturerId = supplyId(row, ['manufacturerId','manufacturerID']);
  const uomId = supplyId(row, ['uomId','uomID','unitOfMeasureId','uomlabelId','stockUomId']);
  const name = supplyText(row, ['itemName','name','partDescription','part_Description','description','itemDescription']);
  const category = supplyText(row, ['category','categoryName','itemCategory']) || lookupName(lookups.category, categoryId);
  const subcategory = supplyText(row, ['subcategory','subcategoryName','itemSubcategory','partType']) || lookupName(lookups.subcategory, subcategoryId);
  const manufacturer = supplyText(row, ['manufacturer','manufacturerName','brand','make']) || lookupName(lookups.manufacturer, manufacturerId);
  const unitOfMeasure = supplyText(row, ['unitOfMeasure','uom','unit','measure','stockingUom','uomLabel','uomlabel']) || lookupName(lookups.uom, uomId);
  const assetType = supplyText(row, ['partType','assetType','asset_Type','assetTypeName','assetTypeDescription','itemType','itemTypeName','recordType','typeName']) || 'Supply Part';
  const activeValue = row?.active ?? row?.partStatusActive ?? row?.part_Status_Active ?? row?.status;
  const activeText = normalize(activeValue);
  const active = activeValue === undefined || activeValue === null || activeValue === ''
    ? true
    : !['FALSE','0','NO','N','OFF','INACTIVE','DISABLED','DELETED','ARCHIVED'].includes(activeText);
  const text = `${name} ${assetType} ${category} ${subcategory}`;
  const excludePattern = compilePattern(globalThis.__SUPPLY_EXCLUDE_PATTERN, DEFAULT_SUPPLY_EXCLUDE_PATTERN);
  return {
    id,
    name: name || `Supply item ${index+1}`,
    sku: supplyText(row, ['itemNumber','internalPartNumber','partNumber','sku','partUpc','partUPC','barcode','upc']),
    assetType,
    category,
    subcategory,
    size: supplyText(row, ['size','itemSize','partSize','part_Size','variant','option']) || sizeFromName(name),
    manufacturer,
    unitOfMeasure,
    active,
    turnoutSupply: normalize(assetType) === 'SUPPLY PART' && normalize(category) === 'TURNOUT GEAR',
    excludedByPattern: excludePattern.test(text),
    raw: row
  };
}

function sizeFromName(name) {
  const text = String(name || '').trim();
  const match = text.match(/(?:\s|-)(XXXXL|XXXL|XXL|XL|LARGE|MEDIUM|SMALL|XS|S|M|L)$/i);
  return match ? match[1].toUpperCase() : '';
}

function inventoryStatus(onHand, minimum) {
  if (onHand === null) return 'Quantity unavailable';
  if (onHand <= 0) return 'Out of stock';
  if (minimum !== null && onHand < minimum) return 'Low stock';
  if (minimum !== null && onHand <= minimum * 1.25) return 'Near minimum';
  return 'In stock';
}

async function fetchSinglePageSafe(endpoint, token, top = 200) {
  try {
    const url = new URL(RESOURCE_ROOT + endpoint);
    if (!url.searchParams.has('$top')) url.searchParams.set('$top', String(top));
    if (!url.searchParams.has('$skip')) url.searchParams.set('$skip', '0');
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' }
    });
    const text = await response.text();
    if (!response.ok) {
      return { endpoint, status: response.status, rows: [], error: `OperativeIQ resource request failed (${response.status}): ${safeApiError(text)}` };
    }
    const payload = JSON.parse(text);
    return { endpoint, status: response.status, rows: arrayPayload(payload) };
  } catch (error) {
    return { endpoint, status: 0, rows: [], error: errorMessage(error) };
  }
}

function odataLiteral(value) {
  const text = String(value ?? '').trim();
  if (/^-?\d+(?:\.\d+)?$/.test(text)) return text;
  return `'${text.replace(/'/g, "''")}'`;
}

async function fetchPagedSafe(baseEndpoint, token, pageSize = 200, maxPages = 10) {
  const allRows = [];
  const pageErrors = [];
  let finalStatus = 200;
  for (let page = 0; page < maxPages; page++) {
    const url = new URL(RESOURCE_ROOT + baseEndpoint);
    url.searchParams.set('$top', String(Math.min(200, pageSize)));
    url.searchParams.set('$skip', String(page * Math.min(200, pageSize)));
    const endpoint = url.pathname.replace('/FrontlineV_live', '') + url.search;
    const result = await fetchSinglePageSafe(endpoint, token, Math.min(200, pageSize));
    finalStatus = result.status;
    if (result.error) {
      pageErrors.push(result.error);
      break;
    }
    allRows.push(...result.rows);
    if (result.rows.length < Math.min(200, pageSize)) break;
  }
  return {
    endpoint: baseEndpoint,
    status: finalStatus,
    rows: allRows,
    error: pageErrors.length ? pageErrors.join(' | ') : null
  };
}

async function loadSupplyInventoryData(env) {
  const token = await getAccessToken(env);
  const [roomResult, categoryResult, knownSupplyPartResult] = await Promise.all([
    fetchSinglePageSafe('/api/supply-rooms', token, 200),
    fetchSinglePageSafe('/api/categories', token, 200),
    fetchSinglePageSafe(`/api/items?$filter=${encodeURIComponent('id eq 3311')}`, token, 1)
  ]);

  const roomRows = roomResult.rows || [];
  const categoryRows = categoryResult.rows || [];
  const roomLookup = makeLookup(roomRows, ['id','roomId','supplyRoomId'], ['name','roomName','supplyRoomName','description']);
  const categoryLookup = makeLookup(categoryRows, ['id','categoryId'], ['name','categoryName','description']);

  const targetRoom = roomRows.find(row => /turnout\s*gear\s*supply\s*warehouse/i.test(
    supplyText(row, ['name','roomName','supplyRoomName','description'])
  ));
  const targetCategory = categoryRows.find(row => normalize(
    supplyText(row, ['name','categoryName','description'])
  ) === 'TURNOUT GEAR');

  const roomId = targetRoom ? supplyId(targetRoom, ['id','roomId','supplyRoomId']) : '';
  const categoryId = targetCategory ? supplyId(targetCategory, ['id','categoryId']) : '';
  const knownSupplyPart = knownSupplyPartResult.rows[0] || null;
  const supplyPartTypeId = knownSupplyPart ? supplyId(knownSupplyPart, ['itemTypeId','itemTypeID']) : '';

  // Supply-room stock levels are stored on ItemRooms. OperativeIQ returns the
  // expected record when ItemRooms is filtered by itemId, but the room-wide
  // collection/paging path can omit those rows. Load the small Turnout Gear
  // Supply Part catalog first, then query ItemRooms directly for each item ID.
  const itemRoomEndpoint = '/api/item-rooms (direct itemId lookups)';

  let itemEndpoint = '/api/items?$top=0';
  let itemResult = { endpoint: '/api/items', status: 200, rows: [], error: null };
  if (categoryId && supplyPartTypeId) {
    const combinedFilter = `categoryId eq ${odataLiteral(categoryId)} and itemTypeId eq ${odataLiteral(supplyPartTypeId)}`;
    itemEndpoint = `/api/items?$filter=${encodeURIComponent(combinedFilter)}`;
    itemResult = await fetchSinglePageSafe(itemEndpoint, token, 200);
  }

  // Some OperativeIQ tenants reject combined OData filters. In that case,
  // page only the Turnout Gear category and retain Supply Parts locally.
  if (categoryId && (!itemResult.rows.length || itemResult.error)) {
    const categoryEndpoint = `/api/items?$filter=${encodeURIComponent(`categoryId eq ${odataLiteral(categoryId)}`)}`;
    const categoryPaged = await fetchPagedSafe(categoryEndpoint, token, 200, 10);
    itemResult = {
      ...categoryPaged,
      rows: categoryPaged.rows.filter(row => {
        const typeId = supplyId(row, ['itemTypeId','itemTypeID']);
        const partType = normalize(supplyText(row, ['partType','itemType','itemTypeName']));
        return (supplyPartTypeId && typeId === supplyPartTypeId) || partType === 'SUPPLY PART';
      }),
      endpoint: '/api/items'
    };
    itemEndpoint = `${categoryEndpoint} (paged fallback; local Supply Part filter)`;
  }

  let itemRoomResult = { endpoint: '/api/item-rooms', status: 200, rows: [], error: null };
  let warehouseItemRooms = [];
  if (roomId && itemResult.rows.length) {
    const itemRoomRequests = await Promise.all(itemResult.rows.map(async itemRow => {
      const itemId = supplyId(itemRow, ['id','itemId','itemID','partId','partID']);
      if (!itemId) return { endpoint: '/api/item-rooms', status: 200, rows: [], error: null };
      const filter = `itemId eq ${odataLiteral(itemId)}`;
      const endpoint = `/api/item-rooms?$filter=${encodeURIComponent(filter)}`;
      return fetchSinglePageSafe(endpoint, token, 200);
    }));

    const errors = itemRoomRequests.map(result => result.error).filter(Boolean);
    const allItemRooms = itemRoomRequests.flatMap(result => result.rows || []);
    warehouseItemRooms = allItemRooms.filter(row => roomIdFromRow(row) === String(roomId));
    itemRoomResult = {
      endpoint: '/api/item-rooms',
      status: itemRoomRequests.every(result => result.status === 200) ? 200 : (itemRoomRequests.find(result => result.status !== 200)?.status || 0),
      rows: warehouseItemRooms,
      error: errors.length ? errors.join(' | ') : null,
      requestCount: itemRoomRequests.length,
      loadedRowsBeforeRoomFilter: allItemRooms.length
    };
  }

  const endpointAliases = new Map([
    ['/api/supply-rooms', roomResult],
    ['/api/categories', categoryResult],
    ['/api/known-supply-part', { ...knownSupplyPartResult, endpoint: '/api/known-supply-part' }],
    ['/api/item-rooms', { ...itemRoomResult, rows: warehouseItemRooms, endpoint: '/api/item-rooms' }],
    ['/api/items', { ...itemResult, endpoint: '/api/items' }]
  ]);
  const rows = endpoint => endpointAliases.get(endpoint)?.rows || [];
  const lookups = {
    category: categoryLookup,
    subcategory: new Map(),
    manufacturer: new Map(),
    uom: new Map(),
    room: roomLookup,
    stockLocation: new Map()
  };
  const results = [...endpointAliases.values()];

  return {
    results,
    rows,
    lookups,
    targetRoom: targetRoom ? {
      id: roomId,
      name: supplyText(targetRoom, ['name','roomName','supplyRoomName','description'])
    } : null,
    targetCategory: targetCategory ? {
      id: categoryId,
      name: supplyText(targetCategory, ['name','categoryName','description'])
    } : null,
    requestedEndpoints: { itemEndpoint, itemRoomEndpoint, knownSupplyPartId: '3311', supplyPartTypeId }
  };
}

function buildSupplyInventory(data) {
  const items = data.rows('/api/items').map((row, index) => normalizeSupplyItem(row, index, data.lookups));
  const itemById = new Map(items.map(item => [String(item.id), item]));
  const itemRoomRows = data.rows('/api/item-rooms');
  const targetRoomName = data.targetRoom?.name || 'Turnout Gear Supply Warehouse';

  const inventoryRows = [];
  const linkedItemIds = new Set();
  for (const itemRoom of itemRoomRows) {
    const itemId = itemIdFromRow(itemRoom);
    const item = itemById.get(String(itemId));
    if (!item || !item.active || !item.turnoutSupply || item.excludedByPattern) continue;

    const onHand = supplyNumber(itemRoom, ['quantityOnHand','onHand','onHandQuantity','currentQuantity','quantity','qty','qtyOnHand']);
    const fallbackTotal = supplyNumber(item.raw, ['totalQuantity']);
    const quantity = onHand ?? fallbackTotal;
    const minimum = supplyNumber(itemRoom, ['reorderPoint','minimumQuantity','minimum','minQuantity','reorderLevel','parLevel','minimumStock','minStock'])
      ?? supplyNumber(item.raw, ['reorderPoint','minimumQuantity','minimum','minQuantity']);
    const maximum = supplyNumber(itemRoom, ['maxQuantity','maximumQuantity','maximum','targetQuantity','maximumStock','maxStock'])
      ?? supplyNumber(item.raw, ['maxQuantity','maximumQuantity','maximum']);
    const stockOrderQuantity = supplyNumber(itemRoom, ['stockOrderQuantity','orderQuantity','recommendedOrderQuantity'])
      ?? supplyNumber(item.raw, ['stockOrderQuantity']);

    linkedItemIds.add(String(itemId));
    inventoryRows.push({
      ...item,
      location: targetRoomName,
      stockLocation: supplyText(itemRoom, ['stockLocation','stockLocationName','bin','binName','stockLocationId']),
      onHand: quantity,
      minimum,
      maximum,
      stockOrderQuantity,
      status: quantity === null ? 'Quantity unavailable' : inventoryStatus(quantity, minimum),
      sourceFields: Object.keys(itemRoom || {}),
      quantitySource: onHand !== null ? 'item-rooms.quantityOnHand' : (fallbackTotal !== null ? 'items.totalQuantity fallback' : 'unavailable')
    });
  }

  return { items, inventoryRows, linkedItemIds };
}

async function probeSupplyInventory(env) {
  globalThis.__SUPPLY_EXCLUDE_PATTERN = env.SUPPLY_EXCLUDE_PATTERN || DEFAULT_SUPPLY_EXCLUDE_PATTERN;
  const data = await loadSupplyInventoryData(env);
  const built = buildSupplyInventory(data);
  const results = data.results.map(result => {
    const sampleRows = result.rows.slice(0, 100);
    const coverage = new Map();
    const numeric = new Map();
    for (const row of sampleRows) {
      for (const [path, value] of supplyEntries(row)) {
        if (value === null || value === undefined || value === '') continue;
        const entry = coverage.get(path) || { present: 0, samples: [] };
        entry.present++;
        const text = typeof value === 'object' ? JSON.stringify(value).slice(0, 160) : String(value).slice(0, 160);
        if (!entry.samples.includes(text) && entry.samples.length < 3) entry.samples.push(text);
        coverage.set(path, entry);
        const parsed = typeof value === 'number' ? value : (typeof value === 'string' && value.trim() && Number.isFinite(Number(value.replace(/[^0-9.-]/g,''))) ? Number(value.replace(/[^0-9.-]/g,'')) : null);
        if (parsed !== null && /qty|quant|count|stock|balance|available|minimum|maximum|reorder|par|onhand/i.test(path)) {
          const n = numeric.get(path) || { present: 0, samples: [] };
          n.present++;
          if (!n.samples.includes(parsed) && n.samples.length < 5) n.samples.push(parsed);
          numeric.set(path, n);
        }
      }
    }
    return {
      endpoint: result.endpoint,
      status: result.status,
      count: result.rows.length,
      fields: [...coverage.entries()].map(([path, info]) => ({ path, ...info })).sort((a,b)=>b.present-a.present||a.path.localeCompare(b.path)),
      numericCandidates: [...numeric.entries()].map(([path, info]) => ({ path, ...info })).sort((a,b)=>b.present-a.present||a.path.localeCompare(b.path)),
      sample: redactDiscoverySample(result.rows[0] || {}),
      error: result.error || null
    };
  });
  return {
    success: true,
    mode: 'READ_ONLY_SUPPLY_INVENTORY_JOIN_PROBE',
    joinedInventoryCount: built.inventoryRows.length,
    matchingCatalogCount: built.items.filter(item => item.active && item.turnoutSupply && !item.excludedByPattern).length,
    results,
    note: 'GET-only Version 25 probe using direct itemId-filtered ItemRooms lookups for the Turnout Gear Supply Part catalog. No OperativeIQ data was changed.'
  };
}

function supplyDebugNumericFields(source) {
  const output = [];
  for (const [path, value] of supplyEntries(source || {})) {
    if (value === null || value === undefined || value === '') continue;
    const parsed = typeof value === 'number'
      ? value
      : (typeof value === 'string' && value.trim() && Number.isFinite(Number(value.replace(/[^0-9.-]/g, '')))
        ? Number(value.replace(/[^0-9.-]/g, ''))
        : null);
    if (parsed !== null) output.push({ path, value: parsed, raw: String(value).slice(0, 120) });
  }
  return output;
}

function supplyDebugQuantityCandidates(source) {
  return supplyDebugNumericFields(source).filter(entry =>
    /qty|quant|count|stock|balance|available|minimum|maximum|reorder|par|onhand|remaining|batch/i.test(entry.path)
  );
}

function supplyDebugSafeRecord(source) {
  return redactDiscoverySample(source || {});
}

async function debugSupplyInventory(env, search = '') {
  globalThis.__SUPPLY_EXCLUDE_PATTERN = env.SUPPLY_EXCLUDE_PATTERN || DEFAULT_SUPPLY_EXCLUDE_PATTERN;
  const data = await loadSupplyInventoryData(env);
  const rawSearch = String(search || '').trim();
  const query = rawSearch.toLowerCase();
  let itemRows = data.rows('/api/items');

  // The production join intentionally loads only Turnout Gear category items.
  // For diagnostics, directly query a known numeric ID or itemName so the
  // explorer can inspect a record even if the category join is misconfigured.
  if (rawSearch) {
    const token = await getAccessToken(env);
    const filter = /^\d+$/.test(rawSearch)
      ? `id eq ${rawSearch}`
      : `contains(tolower(itemName), '${rawSearch.toLowerCase().replace(/'/g, "''")}')`;
    const directEndpoint = `/api/items?$filter=${encodeURIComponent(filter)}&$top=25`;
    const directResult = await fetchSinglePageSafe(directEndpoint, token, 25);
    if (directResult.rows.length || directResult.error) {
      itemRows = directResult.rows;
      data.results.push({ ...directResult, endpoint: '/api/items-direct-search' });
    }
  }
  const normalizedItems = itemRows.map((row, index) => normalizeSupplyItem(row, index, data.lookups));
  const matches = normalizedItems.filter(item => {
    if (!query) return item.turnoutSupply;
    const haystack = [item.id, item.name, item.sku, item.assetType, item.category, item.subcategory, item.manufacturer, item.size]
      .join(' ')
      .toLowerCase();
    return haystack.includes(query);
  }).slice(0, 25);

  const itemRooms = data.rows('/api/item-rooms');
  const batches = [];
  const cycleRows = data.rows('/api/supply-rooms/room-parts-for-cycle-counting');
  const rooms = data.rows('/api/supply-rooms');

  const matchDetails = matches.map(item => {
    const itemId = String(item.id);
    const linkedItemRooms = itemRooms.filter(row => itemIdFromRow(row) === itemId);
    const linkedCycleRows = cycleRows.filter(row => itemIdFromRow(row) === itemId);
    const linkedItemRoomIds = new Set(linkedItemRooms.map(itemRoomIdFromRow).filter(Boolean));
    const linkedBatches = batches.filter(row => itemIdFromRow(row) === itemId || linkedItemRoomIds.has(itemRoomIdFromRow(row)));
    const linkedRoomIds = new Set([
      ...linkedItemRooms.map(roomIdFromRow),
      ...linkedCycleRows.map(roomIdFromRow)
    ].filter(Boolean));
    const linkedRooms = rooms.filter(row => {
      const id = supplyId(row, ['id','roomId','supplyRoomId']);
      return linkedRoomIds.has(id);
    });

    const summarize = rows => rows.map(row => ({
      ids: {
        id: supplyId(row, ['id']),
        itemId: itemIdFromRow(row),
        itemRoomId: itemRoomIdFromRow(row),
        roomId: roomIdFromRow(row)
      },
      roomName: roomNameFromRow(row, data.lookups.room),
      mappedQuantity: quantityFromInventoryRow(row),
      quantityCandidates: supplyDebugQuantityCandidates(row),
      numericFields: supplyDebugNumericFields(row),
      raw: supplyDebugSafeRecord(row)
    }));

    return {
      item: {
        normalized: {
          id: item.id,
          name: item.name,
          sku: item.sku,
          assetType: item.assetType,
          category: item.category,
          subcategory: item.subcategory,
          manufacturer: item.manufacturer,
          size: item.size,
          unitOfMeasure: item.unitOfMeasure,
          active: item.active,
          turnoutSupply: item.turnoutSupply,
          excludedByPattern: item.excludedByPattern
        },
        ids: {
          id: supplyId(item.raw, ['id','itemId','itemID','partId','partID']),
          categoryId: supplyId(item.raw, ['categoryId','categoryID','itemCategoryId']),
          subcategoryId: supplyId(item.raw, ['subcategoryId','subCategoryId','subCategoryID','itemSubcategoryId']),
          manufacturerId: supplyId(item.raw, ['manufacturerId','manufacturerID']),
          uomId: supplyId(item.raw, ['uomId','uomID','unitOfMeasureId'])
        },
        quantityCandidates: supplyDebugQuantityCandidates(item.raw),
        numericFields: supplyDebugNumericFields(item.raw),
        raw: supplyDebugSafeRecord(item.raw)
      },
      joins: {
        itemRooms: summarize(linkedItemRooms),
        itemRoomBatches: summarize(linkedBatches),
        cycleCountRows: summarize(linkedCycleRows),
        supplyRooms: linkedRooms.map(supplyDebugSafeRecord)
      },
      joinStatus: {
        item: true,
        itemRooms: linkedItemRooms.length,
        itemRoomBatches: linkedBatches.length,
        cycleCountRows: linkedCycleRows.length,
        supplyRooms: linkedRooms.length
      }
    };
  });

  return {
    success: true,
    mode: 'READ_ONLY_SUPPLY_API_EXPLORER',
    search: search || null,
    matchedItems: matchDetails.length,
    sourceSummary: data.results.map(result => ({
      endpoint: result.endpoint,
      status: result.status,
      count: result.rows.length,
      error: result.error || null,
      firstRecordFields: Object.keys(result.rows[0] || {})
    })),
    matches: matchDetails,
    instructions: {
      examples: ['/debug/supply?search=Leather', '/debug/supply?search=Hood', '/debug/supply?search=XXXXL'],
      purpose: 'Identify the exact item, item-room, batch, cycle-count, room, quantity, and ID relationship fields used by OperativeIQ.'
    },
    note: 'Read-only diagnostic. All source calls are GET requests and sensitive-looking fields are sanitized.'
  };
}

async function previewSupplyInventory(env) {
  globalThis.__SUPPLY_EXCLUDE_PATTERN = env.SUPPLY_EXCLUDE_PATTERN || DEFAULT_SUPPLY_EXCLUDE_PATTERN;
  const data = await loadSupplyInventoryData(env);
  const built = buildSupplyInventory(data);
  const inventory = built.inventoryRows.sort((a,b) => {
    const rank = {'Out of stock':0,'Low stock':1,'Near minimum':2,'Quantity unavailable':3,'In stock':4};
    return (rank[a.status] ?? 9) - (rank[b.status] ?? 9) || a.name.localeCompare(b.name) || a.size.localeCompare(b.size);
  });
  const matchingCatalog = built.items.filter(item => item.active && item.turnoutSupply && !item.excludedByPattern);
  const includedIds = new Set(inventory.map(item => String(item.id)));
  const excluded = built.items.filter(item => item.active && (!item.turnoutSupply || item.excludedByPattern)).map(item => ({
    id:item.id,
    name:item.name,
    sku:item.sku,
    assetType:item.assetType,
    category:item.category,
    subcategory:item.subcategory,
    reason: !item.turnoutSupply
      ? `Excluded: Asset Type must equal Supply Part and Category must equal Turnout Gear (received ${item.assetType || 'blank'} / ${item.category || 'blank'})`
      : 'Matched SUPPLY_EXCLUDE_PATTERN'
  }));
  const unmatchedCatalog = matchingCatalog.filter(item => !includedIds.has(String(item.id))).map(item => ({
    id:item.id,
    name:item.name,
    sku:item.sku,
    category:item.category,
    subcategory:item.subcategory,
    reason:'Matching catalog part was not linked to a Turnout Gear Supply Warehouse item-room record.'
  }));
  return {
    success: true,
    mode: 'READ_ONLY_SUPPLY_ROOM_INVENTORY_JOIN',
    sourceEndpoint: '/api/supply-rooms + /api/categories + filtered /api/items + /api/item-rooms',
    count: inventory.length,
    totals: {
      skuCount: inventory.length,
      totalOnHand: inventory.reduce((sum,item)=>sum+(item.onHand || 0),0),
      lowStock: inventory.filter(item=>item.status==='Low stock').length,
      outOfStock: inventory.filter(item=>item.status==='Out of stock').length,
      quantityUnavailable: inventory.filter(item=>item.status==='Quantity unavailable').length
    },
    inventory,
    excluded,
    unmatchedCatalog,
    attempted: data.results.map(result => ({ endpoint:result.endpoint,status:result.status,count:result.rows.length,error:result.error||null })),
    filterRules: {
      assetTypeEquals: 'Supply Part',
      categoryEquals: 'Turnout Gear',
      warehouseLocationContains: 'Turnout Gear Supply Warehouse',
      excludePattern: globalThis.__SUPPLY_EXCLUDE_PATTERN
    },
    diagnostics: {
      targetRoom: data.targetRoom,
      targetCategory: data.targetCategory,
      requestedEndpoints: data.requestedEndpoints,
      itemRowsLoaded: data.rows('/api/items').length,
      itemRoomRowsLoaded: data.rows('/api/item-rooms').length,
      matchedInventoryRows: inventory.length
    },
    note: 'Read-only Version 25 supply-room inventory. ItemRooms are queried directly by itemId; quantity is sourced from quantityOnHand and items.totalQuantity is only a fallback.'
  };
}

async function debugTurnoutAsset(env, rawSearch = '') {
  const search = String(rawSearch || '').trim();
  if (!search) {
    return {
      success: false,
      mode: 'READ_ONLY_TURNOUT_ASSET_FIELD_EXPLORER',
      error: 'A search value is required.',
      examples: [
        '/debug/turnout-asset?search=Coat-26',
        '/debug/turnout-asset?search=TG%20-%20Coat-26',
        '/debug/turnout-asset?search=1607001078'
      ]
    };
  }

  const token = await getAccessToken(env);
  const filter = encodeURIComponent("asset_Class eq 'Turnout Gear'");
  const [managementRows, assetRows, turnoutItemRows] = await Promise.all([
    fetchAll(`/api/dynamic-views/vw_Asset_Management?$filter=${filter}`, token, 5000),
    fetchAll(`/api/dynamic-views/vw_Assets_All?$filter=${filter}`, token, 5000),
    // OperativeIQ custom turnout-size values are mirrored into the item's Notes
    // field. Loading the Turnout Gear item catalog once avoids one custom-field
    // request per asset and keeps the Worker below Cloudflare subrequest limits.
    fetchAll(`/api/items?$filter=${encodeURIComponent('categoryId eq 15')}`, token, 200)
  ]);

  const query = search.toLowerCase();
  const matches = rows => rows.filter(row =>
    JSON.stringify(row || {}).toLowerCase().includes(query)
  ).slice(0, 20);
  const matchedManagement = matches(managementRows);
  const matchedAssets = matches(assetRows);

  const compact = row => {
    const populated = {};
    const sizeCandidates = {};
    for (const [key, value] of Object.entries(row || {})) {
      if (value !== null && value !== undefined && String(value).trim() !== '') {
        populated[key] = value;
      }
      if (/size|coat|pant|trouser|inseam|waist|length|note|model|description/i.test(key)) {
        sizeCandidates[key] = value;
      }
    }
    return {
      populatedFields: populated,
      sizeRelatedFields: sizeCandidates,
      allFieldNames: Object.keys(row || {}).sort()
    };
  };

  const normalize = value => String(value || '').trim().toUpperCase().replace(/\s+/g, ' ');
  const tagFrom = row => {
    for (const [key, value] of Object.entries(row || {})) {
      const normalizedKey = key.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (['assettagnumber','assettagpartupc','assettag','partupc'].includes(normalizedKey)) {
        if (value !== null && value !== undefined && String(value).trim()) return normalize(value);
      }
    }
    return '';
  };
  const assetTags = new Set(matchedAssets.map(tagFrom).filter(Boolean));
  const linkedManagement = managementRows.filter(row => assetTags.has(tagFrom(row))).slice(0, 20);

  return {
    success: true,
    mode: 'READ_ONLY_TURNOUT_ASSET_FIELD_EXPLORER',
    search,
    sourceCounts: {
      assetManagement: managementRows.length,
      assetsAll: assetRows.length
    },
    matchCounts: {
      assetManagement: matchedManagement.length,
      assetsAll: matchedAssets.length,
      linkedManagementByAssetTag: linkedManagement.length
    },
    assetManagementMatches: matchedManagement.map(compact),
    assetMatches: matchedAssets.map(compact),
    linkedManagementMatches: linkedManagement.map(compact),
    instructions: {
      purpose: 'Identify the exact OperativeIQ coat-size and pant-size field names for a known turnout asset.',
      nextStep: 'Copy the sizeRelatedFields sections for one known coat and one known pant.'
    },
    note: 'Read-only diagnostic. No OperativeIQ, D1, Gmail, or Google Sheets data was changed.'
  };
}

async function previewTurnoutGear(env, requestedInstant = null) {
  const now = Date.now();
  // The dashboard refreshes frequently. Reuse the current read-only preview for
  // two minutes inside a warm Worker isolate to reduce OperativeIQ traffic and
  // avoid unnecessary CPU spent repeatedly normalizing the same dynamic views.
  if (!requestedInstant && cachedTurnoutPreview && cachedTurnoutPreviewExpiresAt > now) {
    return {
      ...cachedTurnoutPreview,
      cache: { hit: true, expiresAt: new Date(cachedTurnoutPreviewExpiresAt).toISOString() }
    };
  }

  const token = await getAccessToken(env);
  const at = requestedInstant || new Date();
  const todayKey = easternDateKey(at);
  const filter = encodeURIComponent("asset_Class eq 'Turnout Gear'");
  const [managementRows, assetRows, turnoutItemRows] = await Promise.all([
    fetchAll(`/api/dynamic-views/vw_Asset_Management?$filter=${filter}`, token, 5000),
    fetchAll(`/api/dynamic-views/vw_Assets_All?$filter=${filter}`, token, 5000),
    // OperativeIQ custom turnout-size values are mirrored into the item's Notes
    // field. Loading the Turnout Gear item catalog once avoids one custom-field
    // request per asset and keeps the Worker below Cloudflare subrequest limits.
    fetchAll(`/api/items?$filter=${encodeURIComponent('categoryId eq 15')}`, token, 200)
  ]);

  const normalizeKey = value => String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const text = value => value === null || value === undefined ? '' : String(value).trim();
  const joinKey = value => text(value).toUpperCase().replace(/\s+/g, ' ');
  const active = value => {
    if (value === true || value === 1) return true;
    return /^(true|1|yes|active)$/i.test(text(value));
  };
  const dayDifference = (fromKey, toKey) => {
    if (!fromKey || !toKey) return null;
    const from = Date.parse(`${fromKey}T00:00:00Z`);
    const to = Date.parse(`${toKey}T00:00:00Z`);
    return Number.isFinite(from) && Number.isFinite(to)
      ? Math.round((to - from) / 86400000)
      : null;
  };

  // Normalize field names once per source record. The previous implementation
  // repeatedly scanned Object.entries() for every field lookup, which could
  // exceed the Cloudflare Worker CPU limit and surface as error 1102 / HTTP 503.
  const indexed = source => {
    const values = Object.create(null);
    for (const [key, value] of Object.entries(source || {})) {
      values[normalizeKey(key)] = value;
    }
    return { source, values };
  };
  const get = (record, ...names) => {
    for (const name of names) {
      const value = record?.values?.[normalizeKey(name)];
      if (value !== null && value !== undefined) return value;
    }
    return null;
  };

  const indexedManagementRows = managementRows.map(indexed);
  const indexedAssetRows = assetRows.map(indexed);
  const indexedTurnoutItems = turnoutItemRows.map(indexed);
  const itemByTag = new Map();
  const itemByName = new Map();
  for (const item of indexedTurnoutItems) {
    const tag = joinKey(get(item, 'itemNumber', 'assetTagNumber', 'assetTag'));
    const name = joinKey(get(item, 'itemName', 'description'));
    if (tag) itemByTag.set(tag, item);
    if (name) itemByName.set(name, item);
  }
  const managementByTag = new Map();
  for (const row of indexedManagementRows) {
    const tag = joinKey(get(row, 'asset_Tag___Part_UPC', 'assetTagPartUpc'));
    if (!tag) continue;
    const current = managementByTag.get(tag);
    if (current) current.push(row);
    else managementByTag.set(tag, [row]);
  }

  const diagnostics = {
    missingJoin: 0,
    wrongAssetClass: 0,
    wrongCategory: 0,
    inactivePart: 0,
    blankLocation: 0,
    supplyWarehouse: 0,
    missingNextServiceDate: 0,
    outsideThirtyDays: 0,
    duplicateAssetTag: 0
  };
  const selected = new Map();
  const assetTagSet = new Set();

  for (const asset of indexedAssetRows) {
    const tag = joinKey(get(asset, 'asset_Tag_Number', 'assetTagNumber'));
    if (!tag) {
      diagnostics.missingJoin++;
      continue;
    }
    assetTagSet.add(tag);
    const matchingManagementRows = managementByTag.get(tag);
    if (!matchingManagementRows?.length) {
      diagnostics.missingJoin++;
      continue;
    }

    for (const management of matchingManagementRows) {
      const assetClass = text(get(asset, 'asset_Class') ?? get(management, 'asset_Class'));
      const category = text(get(asset, 'category') ?? get(management, 'category'));
      const subcategory = text(get(asset, 'subcategory') ?? get(management, 'subcategory'));
      // OperativeIQ's asset history report exposes both assignment and physical
      // location concepts. The physical Location/To value is authoritative for
      // warehouse classification, even when a Crew Member remains on the row.
      const location = text(
        get(asset, 'location')
        ?? get(asset, 'to')
        ?? get(management, 'location')
        ?? get(management, 'to')
      );
      const crewMember = text(
        get(asset, 'crew_Member')
        ?? get(asset, 'crewMember')
        ?? get(management, 'crew_Member')
        ?? get(management, 'crewMember')
      );
      const partStatus = get(management, 'part_Status_Active');
      const nextValue = get(
        management,
        'next_Preventative_Maintenace_Date',
        'next_Preventative_Maintenance_Date'
      );
      const lastValue = get(
        management,
        'preventative_Maintenace_Date',
        'preventative_Maintenance_Date'
      );
      const daysValue = get(
        management,
        'days_Until_Next_Preventative_Maintenace',
        'days_Until_Next_Preventative_Maintenance'
      );
      const nextDate = dynamicViewDateKey(nextValue);
      const lastDate = dynamicViewDateKey(lastValue);
      const parsedDays = Number(String(daysValue ?? '').replace(/[^0-9.-]/g, ''));
      const daysLeft = Number.isFinite(parsedDays) && text(daysValue)
        ? parsedDays
        : dayDifference(todayKey, nextDate);

      if (normalize(assetClass) !== 'TURNOUT GEAR') {
        diagnostics.wrongAssetClass++;
        continue;
      }
      if (category && normalize(category) !== 'TURNOUT GEAR') {
        diagnostics.wrongCategory++;
        continue;
      }
      // Include every active Turnout Gear subcategory. Warehouse inventory can
      // include coats, pants, boots, helmets, hoods, gloves, and other PPE.
      if (!active(partStatus)) {
        diagnostics.inactivePart++;
        continue;
      }
      if (!location) {
        diagnostics.blankLocation++;
        continue;
      }
      const isSupplyWarehouse = /turnout\s*gear\s*supply\s*warehouse|supply\s*room/i.test(location);
      if (isSupplyWarehouse) diagnostics.supplyWarehouse++;
      if (!nextDate) diagnostics.missingNextServiceDate++;
      if (!Number.isFinite(daysLeft) || daysLeft < 0 || daysLeft > 30) diagnostics.outsideThirtyDays++;

      const issuedTo = crewMember
        || (/^Crew:/i.test(location) ? location.replace(/^Crew:\s*/i, '').trim() : '')
        || (isSupplyWarehouse ? 'Turnout Gear Supply Warehouse' : 'Unassigned');

      const assetTag = text(get(asset, 'asset_Tag_Number'))
        || text(get(management, 'asset_Tag___Part_UPC'));
      const partDescription = text(get(management, 'part_Description'))
        || text(get(asset, 'asset_Description'));
      const catalogItem = itemByTag.get(joinKey(assetTag))
        || itemByName.get(joinKey(partDescription));
      // Coat Size and Pant Size are custom-created fields in OperativeIQ. In the
      // item API their current value is mirrored in Notes (as shown on the asset
      // screen), so use Notes only for the garment's applicable size field.
      const customSizeValue = text(get(catalogItem, 'notes'));
      const isCoat = normalize(subcategory).includes('COAT');
      const isPant = normalize(subcategory).includes('PANT');
      const coatSize = isCoat ? customSizeValue : '';
      const pantSize = isPant ? customSizeValue : '';

      const row = {
        issuedTo,
        currentLocation: location,
        locationType: isSupplyWarehouse
          ? 'Warehouse'
          : /^Crew:/i.test(location)
            ? 'Issued to Member'
            : /warehouse|supply room/i.test(location)
              ? 'Warehouse'
              : /reserve|cache|spare/i.test(location)
                ? 'Reserve'
                : /station/i.test(location)
                  ? 'Station'
                  : 'Other',
        gearIdentifier: assetTag,
        assetTag,
        manufacturer: text(get(management, 'manufacturer'))
          || text(get(management, 'manufacturer_Name'))
          || text(get(asset, 'manufacturer'))
          || text(get(asset, 'manufacturer_Name')),
        model: text(get(management, 'model'))
          || text(get(management, 'model_Number'))
          || text(get(asset, 'model'))
          || text(get(asset, 'model_Number')),
        coatSize,
        pantSize,
        size: isCoat
          ? coatSize
          : isPant
            ? pantSize
            : (text(get(management, 'size', 'part_Size'))
              || text(get(asset, 'size', 'asset_Size'))),
        sizeSource: (isCoat || isPant) && customSizeValue ? 'OperativeIQ custom field (item notes mirror)' : 'Not mapped',
        barcode: text(get(management, 'barcode'))
          || text(get(management, 'bar_Code'))
          || text(get(asset, 'barcode'))
          || text(get(asset, 'bar_Code')),
        serialNumber: text(get(asset, 'serial_Number'))
          || text(get(asset, 'serialNumber'))
          || text(get(management, 'serial_Number'))
          || text(get(management, 'serialNumber')),
        physicalLocation: location,
        crewMember,
        lastServiceDate: lastDate,
        nextServiceDate: nextDate,
        daysLeft,
        assetClass,
        category,
        subcategory,
        partDescription,
        partStatusActive: active(partStatus),
        locationStatus: text(get(asset, 'location_Status')),
        plannedDecommissionDate: dateKey(
          get(management, 'planned_Decommission_Date')
          || get(asset, 'planned_Decommission_Date')
        )
      };

      if (selected.has(tag)) diagnostics.duplicateAssetTag++;
      selected.set(tag, row);
    }
  }

  const rows = [...selected.values()].sort((a, b) =>
    a.locationType.localeCompare(b.locationType)
    || a.currentLocation.localeCompare(b.currentLocation)
    || a.issuedTo.localeCompare(b.issuedTo)
    || a.gearIdentifier.localeCompare(b.gearIdentifier)
  );

  const result = {
    success: true,
    mode: 'READ_ONLY_TURNOUT_GEAR_PREVIEW',
    timezone: 'America/New_York',
    evaluatedAt: at.toISOString(),
    reportDate: todayKey,
    sourceCounts: {
      assetManagement: managementRows.length,
      assetsAll: assetRows.length,
      turnoutItems: turnoutItemRows.length,
      joinedAssetTags: [...managementByTag.keys()].filter(key => assetTagSet.has(key)).length
    },
    filters: {
      assetClass: 'Turnout Gear',
      category: 'Turnout Gear when populated',
      subcategories: 'All active Turnout Gear subcategories',
      partStatusActive: true,
      serviceWindow: 'All records returned; dashboard applies due-date filters',
      warehouseLocation: 'Turnout Gear Supply Warehouse'
    },
    recordCount: rows.length,
    columns: [
      'Issued To', 'Current Location', 'Location Type', 'Gear Identifier',
      'Part Description', 'Subcategory', 'Size', 'Serial Number', 'Crew Member',
      'Last Service Date', 'Next Service Date', 'Days Left', 'Planned Decommission Date'
    ],
    rows,
    sheetRows: rows.map(row => [
      row.issuedTo,
      row.gearIdentifier,
      displayDate(row.lastServiceDate),
      displayDate(row.nextServiceDate),
      row.daysLeft
    ]),
    diagnostics,
    cache: { hit: false, ttlSeconds: 120 },
    note: 'Read-only active turnout gear inventory preview. Physical Location/To overrides crew assignment for warehouse classification. No OperativeIQ, D1, Gmail, or Google Sheets data was changed.'
  };

  if (!requestedInstant) {
    cachedTurnoutPreview = result;
    cachedTurnoutPreviewExpiresAt = now + 120000;
  }
  return result;
}

async function previewPhysicalDue(env, requestedInstant = null) {
  const token = await getAccessToken(env);
  const at = requestedInstant || new Date();
  const todayKey = easternDateKey(at);
  const cutoffKey = addDaysToDateKey(todayKey, 30);
  const filter = encodeURIComponent("asset_Class eq 'Staff'");
  const [managementRows, assetRows] = await Promise.all([
    fetchAll(`/api/dynamic-views/vw_Asset_Management?$filter=${filter}`, token, 20000),
    fetchAll(`/api/dynamic-views/vw_Assets_All?$filter=${filter}`, token, 20000)
  ]);

  const normalizedKey = value => String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const valueByNames = (source, names) => {
    const wanted = new Set(names.map(normalizedKey));
    for (const [key, value] of Object.entries(source || {})) {
      if (wanted.has(normalizedKey(key))) return value;
    }
    return null;
  };
  const valueByPattern = (source, pattern) => {
    for (const [key, value] of Object.entries(source || {})) {
      if (pattern.test(normalizedKey(key))) return value;
    }
    return null;
  };
  const text = value => value === null || value === undefined ? '' : String(value).trim();
  const joinKey = value => text(value).toUpperCase().replace(/\s+/g, ' ');
  const active = value => {
    if (value === true || value === 1) return true;
    return /^(true|1|yes|active)$/i.test(text(value));
  };
  const dayDifference = (fromKey, toKey) => {
    if (!fromKey || !toKey) return null;
    const from = Date.parse(`${fromKey}T00:00:00Z`);
    const to = Date.parse(`${toKey}T00:00:00Z`);
    return Number.isFinite(from) && Number.isFinite(to)
      ? Math.round((to - from) / 86400000)
      : null;
  };
  const managementSerial = row => valueByNames(row, [
    'serial___Part_Number', 'serial_Part_Number', 'serialPartNumber',
    'serial_Number', 'serialNumber'
  ]) || valueByPattern(row, /^serialpartnumber$/i);
  const assetSerial = row => valueByNames(row, ['serial_Number', 'serialNumber']);

  const managementBySerial = new Map();
  for (const row of managementRows) {
    const serial = joinKey(managementSerial(row));
    if (!serial) continue;
    if (!managementBySerial.has(serial)) managementBySerial.set(serial, []);
    managementBySerial.get(serial).push(row);
  }

  const diagnostics = {
    missingSerialNumber: 0,
    missingJoin: 0,
    wrongAssetClass: 0,
    inactivePart: 0,
    catalogPart: 0,
    missingStaffMember: 0,
    missingDueDate: 0,
    beyondThirtyDays: 0,
    duplicateStaffRecord: 0
  };
  const selected = new Map();

  for (const asset of assetRows) {
    const serial = joinKey(assetSerial(asset));
    if (!serial) {
      diagnostics.missingSerialNumber++;
      continue;
    }

    const matchingManagementRows = managementBySerial.get(serial) || [];
    if (!matchingManagementRows.length) {
      diagnostics.missingJoin++;
      continue;
    }

    for (const management of matchingManagementRows) {
      const assetClass = text(
        valueByNames(asset, ['asset_Class', 'assetClass'])
        || valueByNames(management, ['asset_Class', 'assetClass'])
      );
      const partStatus = valueByNames(management, ['part_Status_Active', 'partStatusActive'])
        ?? valueByNames(asset, ['part_Status_Active', 'partStatusActive']);
      const catalogValue = valueByNames(management, ['catalog_Part', 'catalogPart', 'isCatalogPart'])
        ?? valueByNames(asset, ['catalog_Part', 'catalogPart', 'isCatalogPart']);
      const staffMember = text(valueByNames(management, ['part_Description', 'partDescription']))
        || text(valueByNames(asset, ['part_Description', 'partDescription', 'asset_Description', 'assetDescription']));
      const dueValue = valueByNames(management, ['next_Preventative_Maintenace_Date', 'nextPreventativeMaintenanceDate'])
        ?? valueByPattern(management, /^nextpreventativemainten.*date$/i);
      const lastValue = valueByNames(management, ['preventative_Maintenace_Date', 'preventativeMaintenanceDate'])
        ?? valueByPattern(management, /^preventativemainten.*date$/i);
      // The physical report stores month-based calendar dates at midnight UTC.
      // Preserve the ISO date portion so 2026-01-01T00:00:00Z remains 1/1/2026
      // instead of shifting to 12/31/2025 in America/New_York.
      const dueDate = dateKey(dueValue);
      const lastPhysicalDate = dateKey(lastValue);

      if (normalize(assetClass) !== 'STAFF') {
        diagnostics.wrongAssetClass++;
        continue;
      }
      if (!active(partStatus)) {
        diagnostics.inactivePart++;
        continue;
      }
      if (normalizeBoolean(catalogValue)) {
        diagnostics.catalogPart++;
        continue;
      }
      if (!staffMember) {
        diagnostics.missingStaffMember++;
        continue;
      }
      if (!dueDate) {
        diagnostics.missingDueDate++;
        continue;
      }
      if (dueDate > cutoffKey) {
        diagnostics.beyondThirtyDays++;
        continue;
      }

      const daysUntilDue = dayDifference(todayKey, dueDate);
      const row = {
        staffMember,
        dueForPhysical: dueDate,
        lastPhysical: lastPhysicalDate,
        daysUntilDue,
        overdue: Number.isFinite(daysUntilDue) && daysUntilDue < 0,
        serialNumber: text(assetSerial(asset)),
        assetTag: text(valueByNames(asset, ['asset_Tag_Number', 'assetTagNumber']))
          || text(valueByNames(management, ['asset_Tag___Part_UPC', 'assetTagPartUpc'])),
        manufacturer: text(valueByNames(management, ['manufacturer']))
          || text(valueByNames(asset, ['manufacturer'])),
        location: text(valueByNames(asset, ['location']))
          || text(valueByNames(management, ['location'])),
        assetClass,
        partStatusActive: true,
        catalogPart: false
      };

      const current = selected.get(serial);
      if (current) diagnostics.duplicateStaffRecord++;
      if (
        !current
        || row.dueForPhysical > current.dueForPhysical
        || (
          row.dueForPhysical === current.dueForPhysical
          && row.lastPhysical > current.lastPhysical
        )
      ) {
        selected.set(serial, row);
      }
    }
  }

  const rows = [...selected.values()].sort((a, b) =>
    a.dueForPhysical.localeCompare(b.dueForPhysical)
    || a.staffMember.localeCompare(b.staffMember)
  );
  const assetSerialSet = new Set(
    assetRows.map(asset => joinKey(assetSerial(asset))).filter(Boolean)
  );

  return {
    success: true,
    mode: 'READ_ONLY_PHYSICAL_DUE_PREVIEW',
    timezone: 'America/New_York',
    evaluatedAt: at.toISOString(),
    reportDate: todayKey,
    cutoffDate: cutoffKey,
    sourceCounts: {
      assetManagement: managementRows.length,
      assetsAll: assetRows.length,
      turnoutItems: turnoutItemRows.length,
      joinedSerialNumbers: [...managementBySerial.keys()].filter(key => assetSerialSet.has(key)).length
    },
    filters: {
      assetClass: 'Staff',
      partStatusActive: true,
      catalogPart: false,
      dueForPhysical: {
        includesPastDue: true,
        throughDate: cutoffKey
      }
    },
    recordCount: rows.length,
    headers: ['Staff Member', 'Due For Physical'],
    rows,
    sheetRows: rows.map(row => [row.staffMember, displayDate(row.dueForPhysical)]),
    diagnostics,
    note: 'Read-only dynamic-view join preview matching the Due For Physical Next 30 Days report. No OperativeIQ, D1, Gmail, or Google Sheets data was changed.'
  };
}

async function previewCrewEmails(env) {
  const token = await getAccessToken(env);
  const crewRows = await fetchAll('/api/crews', token, 10000);
  const text = value => value === null || value === undefined ? '' : String(value).trim();
  const active = value => {
    if (value === true || value === 1) return true;
    return /^(true|1|yes|active)$/i.test(text(value));
  };
  const validEmail = value => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text(value));
  const statusValueCounts = {};
  const diagnostics = {
    inactive: 0,
    missingName: 0,
    missingOrInvalidEmail: 0,
    duplicateEmail: 0
  };
  const selected = new Map();
  const seenEmails = new Set();

  for (const crew of crewRows) {
    const statusKey = text(crew?.status) || '(blank)';
    statusValueCounts[statusKey] = (statusValueCounts[statusKey] || 0) + 1;

    if (!active(crew?.status)) {
      diagnostics.inactive++;
      continue;
    }

    const firstName = text(crew?.firstName);
    const lastName = text(crew?.lastName);
    const email = text(crew?.email).toLowerCase();
    if (!firstName || !lastName) {
      diagnostics.missingName++;
      continue;
    }
    if (!validEmail(email)) {
      diagnostics.missingOrInvalidEmail++;
      continue;
    }

    if (seenEmails.has(email)) diagnostics.duplicateEmail++;
    seenEmails.add(email);
    const recordKey = crew?.id ?? `${firstName}|${lastName}|${email}`;
    selected.set(recordKey, {
      crewId: crew?.id ?? null,
      employeeId: text(crew?.employeeId),
      firstName,
      lastName,
      fullName: `${firstName} ${lastName}`,
      operativeLocationName: `${lastName} ${firstName}`,
      email,
      status: crew?.status
    });
  }

  const rows = [...selected.values()].sort((a, b) =>
    a.lastName.localeCompare(b.lastName) || a.firstName.localeCompare(b.firstName)
  );

  return {
    success: true,
    mode: 'READ_ONLY_CREW_EMAIL_PREVIEW',
    sourceRecordCount: crewRows.length,
    activeEmailCount: rows.length,
    rows,
    diagnostics: {
      ...diagnostics,
      statusValueCounts
    },
    note: 'Active OperativeIQ crew names and email addresses only. No OperativeIQ, D1, Gmail, or Google Sheets data was changed.'
  };
}

async function probeReadOnlyResource(path, token) {
  const url = new URL(RESOURCE_ROOT + path);
  url.searchParams.set('$top', '1');
  url.searchParams.set('$skip', '0');
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' }
  });
  const text = await response.text();
  const result = {
    path,
    status: response.status,
    overallCount: numericHeader(response.headers.get('X-Overall-Count'))
  };
  if (!response.ok) {
    result.error = safeApiError(text);
    return result;
  }

  try {
    const payload = JSON.parse(text);
    const records = arrayPayload(payload);
    result.returnedCount = records.length;
    result.fields = Object.keys(records[0] || {});
    result.sample = redactDiscoverySample(records[0] || {});
  } catch (error) {
    result.parseError = errorMessage(error);
  }
  return result;
}

function modelApiResourceCandidates(modelName) {
  const trimmed = String(modelName || '')
    .replace(/^(?:Ems|Api)/, '')
    .replace(/Model$/, '');
  const slug = trimmed
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1-$2')
    .toLowerCase();
  if (!slug) return [];

  const variants = new Set([slug]);
  if (slug.endsWith('s')) variants.add(slug.slice(0, -1));
  else variants.add(`${slug}s`);
  for (const value of [...variants]) {
    variants.add(value.replace(/questionary/g, 'questionnaire'));
    variants.add(value.replace(/questionaries/g, 'questionnaires'));
  }
  return [...variants].map(value => `/api/${value}`);
}

async function probeOperationalQuestionLinkage(env, requestedInstant = null) {
  const token = await getAccessToken(env);
  const at = requestedInstant || new Date();
  const shift = activeEasternShift(at);
  const [units, questions, questionaries, unitStatuses, unitLocations] = await Promise.all([
    fetchAll('/api/units', token, 500),
    fetchAll('/api/vh-questions?$orderby=id', token, 10000),
    fetchAll('/api/vh-questionaries?$orderby=id', token, 1000),
    fetchAll('/api/unit-statuses', token, 500),
    fetchAll('/api/unit-locations', token, 500)
  ]);

  const operationalPattern = operationalCheckPattern(env);
  const dueQuestionaries = questionaries
    .map(item => ({
      ...item,
      questionnaireName: item.questionaryName || item.questionnaireName || '',
      tuesday: item.tuesday ?? item.tusday ?? false
    }))
    .filter(item => item.status === undefined || normalizeBoolean(item.status))
    .filter(item => normalizeBoolean(item.isScheduled))
    .filter(item => operationalPattern.test(item.questionnaireName))
    .filter(item => assignedOnShiftDate(item, shift.shiftKey));
  const dueById = new Map(dueQuestionaries.map(item => [String(item.id), item]));

  const statusesById = new Map(unitStatuses.map(item => [String(item.id), item]));
  const locationsById = new Map();
  for (const location of unitLocations) {
    for (const key of [location.id, location.roomId]) {
      if (key !== null && key !== undefined && key !== '') {
        locationsById.set(String(key), location);
      }
    }
  }
  const unitsById = new Map(units.map(item => [String(item.id), item]));
  const unitsByTypeId = new Map();
  const unitsByFleetUnitTypeId = new Map();
  for (const unit of units) {
    const key = String(unit.typeId ?? '');
    if (key) {
      if (!unitsByTypeId.has(key)) unitsByTypeId.set(key, []);
      unitsByTypeId.get(key).push(unit);
    }
    const fleetKey = String(unit.fleetUnitTypeId ?? '');
    if (fleetKey) {
      if (!unitsByFleetUnitTypeId.has(fleetKey)) unitsByFleetUnitTypeId.set(fleetKey, []);
      unitsByFleetUnitTypeId.get(fleetKey).push(unit);
    }
  }

  const links = new Map();
  for (const question of questions) {
    if (question.status !== undefined && !normalizeBoolean(question.status)) continue;
    const questionary = dueById.get(String(question.questionariesId));
    const linkValue = question.truckId;
    if (!questionary || linkValue === null || linkValue === undefined || linkValue === '') continue;
    const key = `${linkValue}|${questionary.id}`;
    const current = links.get(key) || {
      linkValue,
      questionaryId: questionary.id,
      questionnaireName: questionary.questionnaireName,
      questionCount: 0
    };
    current.questionCount += 1;
    links.set(key, current);
  }

  const directUnitAssignments = [];
  const unitTypeAssignments = [];
  const fleetUnitTypeAssignments = [];
  const unmatchedLinks = [];
  let unmatchedLinkCount = 0;
  for (const link of links.values()) {
    const direct = unitsById.get(String(link.linkValue));
    if (direct) directUnitAssignments.push(linkageAssignment(direct, link, statusesById, locationsById));

    const typeUnits = unitsByTypeId.get(String(link.linkValue)) || [];
    for (const unit of typeUnits) {
      unitTypeAssignments.push(linkageAssignment(unit, link, statusesById, locationsById));
    }
    const fleetTypeUnits = unitsByFleetUnitTypeId.get(String(link.linkValue)) || [];
    for (const unit of fleetTypeUnits) {
      fleetUnitTypeAssignments.push(linkageAssignment(unit, link, statusesById, locationsById));
    }
    if (!direct && !typeUnits.length && !fleetTypeUnits.length) {
      unmatchedLinkCount += 1;
      unmatchedLinks.push(link);
    }
  }

  const activeOnly = rows => rows
    .filter(item => statusClass(item.inServiceStatus) === 'active')
    .sort((a, b) =>
      String(a.locationName).localeCompare(String(b.locationName)) ||
      String(a.unitNumber).localeCompare(String(b.unitNumber)) ||
      String(a.questionnaireName).localeCompare(String(b.questionnaireName))
    );
  const directActive = activeOnly(directUnitAssignments);
  const typeActive = activeOnly(unitTypeAssignments);
  const fleetTypeActive = activeOnly(fleetUnitTypeAssignments);

  return {
    success: true,
    mode: 'READ_ONLY_OPERATIONAL_QUESTION_LINKAGE_PROBE',
    evaluatedAt: at.toISOString(),
    shiftKey: shift.shiftKey,
    operationalPattern: operationalPattern.source,
    sourceCounts: {
      units: units.length,
      questions: questions.length,
      questionaries: questionaries.length,
      dueOperationalQuestionaries: dueQuestionaries.length,
      uniqueQuestionLinks: links.size
    },
    dueOperationalQuestionaries: dueQuestionaries.map(item => ({
      id: item.id,
      questionnaireName: item.questionnaireName,
      schedulerType: item.schedulerType
    })),
    hypotheses: {
      directUnitId: {
        join: 'vh-questions.truckId = units.id',
        activeAssignmentCount: directActive.length,
        assignments: directActive
      },
      unitTypeId: {
        join: 'vh-questions.truckId = units.typeId',
        activeAssignmentCount: typeActive.length,
        assignments: typeActive
      },
      fleetUnitTypeId: {
        join: 'vh-questions.truckId = units.fleetUnitTypeId',
        activeAssignmentCount: fleetTypeActive.length,
        assignments: fleetTypeActive
      }
    },
    unmatchedLinkCount,
    unmatchedLinks,
    unitIdentifierValues: {
      ids: [...new Set(units.map(item => item.id))].sort(numericSort),
      typeIds: [...new Set(units.map(item => item.typeId).filter(value => value !== null && value !== undefined))].sort(numericSort),
      fleetUnitTypeIds: [...new Set(units.map(item => item.fleetUnitTypeId).filter(value => value !== null && value !== undefined))].sort(numericSort)
    },
    note: 'Read-only linkage comparison. No OperativeIQ, D1, or Google Sheets data was changed.'
  };
}

function numericSort(a, b) {
  return Number(a) - Number(b);
}

function linkageAssignment(unit, link, statusesById, locationsById) {
  const locationKey = [unit.locationId, unit.roomId]
    .find(value => value !== null && value !== undefined && value !== '');
  const location = locationsById.get(String(locationKey ?? '')) || {};
  const inServiceStatus =
    statusesById.get(String(unit.truckStatusId))?.truckStatusName ||
    unit.fleetStatus || unit.status || '';
  return {
    linkValue: link.linkValue,
    unitId: unit.id,
    unitTypeId: unit.typeId,
    locationName: location.locationName || location.locationDescription || '',
    unitNumber: unit.truckNumber || `Truck ID ${unit.id}`,
    inServiceStatus,
    questionaryId: link.questionaryId,
    questionnaireName: link.questionnaireName,
    questionCount: link.questionCount
  };
}

async function previewInferredOperationalChecks(env, requestedInstant = null) {
  const token = await getAccessToken(env);
  const at = requestedInstant || new Date();
  const shiftWindow = activeEasternShift(at);
  const dailyShiftPath = '/api/daily-shifts?' + new URLSearchParams({
    '$select': [
      'id', 'shift', 'truckId', 'entryDate', 'entryTime', 'status', 'closed',
      'createdTime', 'lastModificationTime'
    ].join(','),
    '$orderby': 'entryDate desc,entryTime desc'
  }).toString();
  const [states, shifts, units, unitStatuses, unitLocations] = await Promise.all([
    fetchAll('/api/daily-shift-questionaries-state?$orderby=id desc', token, 5000),
    fetchAll(dailyShiftPath, token, 3000),
    fetchAll('/api/units', token, 500),
    fetchAll('/api/unit-statuses', token, 500),
    fetchAll('/api/unit-locations', token, 500)
  ]);

  const operationalPattern = operationalCheckPattern(env);
  const shiftsById = new Map(shifts.map(item => [String(item.id), item]));
  const unitsById = new Map(units.map(item => [String(item.id), item]));
  const statusesById = new Map(unitStatuses.map(item => [String(item.id), item]));
  const locationsById = new Map();
  for (const location of unitLocations) {
    for (const key of [location.id, location.roomId]) {
      if (key !== null && key !== undefined && key !== '') {
        locationsById.set(String(key), location);
      }
    }
  }
  let d1Assignments = [];
  if (env.DB) {
    const result = await env.DB.prepare(`
      SELECT apparatus_number,primary_assignment,current_assignment
      FROM vehicles
    `).all();
    d1Assignments = result.results || [];
  }
  const assignmentByApparatus = new Map(d1Assignments.map(item => [
    String(item.apparatus_number || '').toUpperCase(),
    item.current_assignment || item.primary_assignment || ''
  ]));

  const templates = new Map();
  const currentStates = new Map();
  const unjoinedShiftIds = new Set();
  for (const state of states) {
    const sourceShift = shiftsById.get(String(state.shiftId));
    if (!sourceShift) {
      unjoinedShiftIds.add(String(state.shiftId));
      continue;
    }
    const unit = unitsById.get(String(sourceShift.truckId));
    if (!unit || !normalizeBoolean(state.isScheduled)) continue;
    if (dateKey(sourceShift.entryDate) > shiftWindow.shiftKey) continue;
    const questionnaireName = state.questionaryName || '';
    if (!operationalPattern.test(questionnaireName)) continue;
    const key = `${unit.id}|${state.questionaryId}`;
    const candidate = {
      ...state,
      questionnaireName,
      tuesday: state.tuesday ?? state.tusday ?? false,
      unit,
      sourceShift
    };
    if (!templates.has(key)) templates.set(key, candidate);
    if (dateKey(sourceShift.entryDate) === shiftWindow.shiftKey && !currentStates.has(key)) {
      currentStates.set(key, candidate);
    }
  }

  const configuredIncomplete = [];
  let currentStateMatchCount = 0;
  let completedCurrentCount = 0;
  let notDueCurrentCount = 0;
  for (const [key, template] of templates) {
    const unit = template.unit;
    const inServiceStatus =
      statusesById.get(String(unit.truckStatusId))?.truckStatusName ||
      unit.fleetStatus || unit.status || '';
    if (statusClass(inServiceStatus) !== 'active') continue;

    const current = currentStates.get(key) || null;
    if (current) currentStateMatchCount += 1;
    if (current && !isIncompleteQuestionnaireState(current.currentState)) {
      if (normalize(current.currentState) === '3') completedCurrentCount += 1;
      else notDueCurrentCount += 1;
      continue;
    }

    const locationKey = [unit.locationId, unit.roomId]
      .find(value => value !== null && value !== undefined && value !== '');
    const location = locationsById.get(String(locationKey ?? '')) || {};
    const apparatus = apparatusNumber(unit.truckNumber);
    const assignmentRecordFound = assignmentByApparatus.has(apparatus);
    const currentAssignment = assignmentByApparatus.get(apparatus) || '';
    configuredIncomplete.push({
      date: shiftWindow.shiftKey,
      locationName: location.locationName || location.locationDescription || template.sourceShift.shift || '',
      unitNumber: unit.truckNumber || `Truck ID ${unit.id}`,
      inServiceStatus,
      questionnaireName: template.questionnaireName,
      status: 'Not Completed',
      unitId: unit.id,
      questionaryId: template.questionaryId,
      currentState: current?.currentState ?? null,
      currentStateId: current?.id ?? null,
      currentShiftId: current?.shiftId ?? null,
      inferredFromStateId: template.id,
      inferredFromShiftId: template.shiftId,
      inferredFromDate: dateKey(template.sourceShift.entryDate),
      schedulerType: template.schedulerType ?? null,
      scheduledToday: assignedOnShiftDate(template, shiftWindow.shiftKey),
      missingCurrentState: !current,
      lastCompletedDateTime: template.lastCompletedDateTime ?? null,
      completedFromLastCompletedDateTime: !current && completedDuringShift(
        template.lastCompletedDateTime,
        shiftWindow.shiftKey,
        shiftWindow.nextShiftKey
      ),
      currentAssignment,
      assignmentRecordFound,
      assignmentCompatible: assignmentMatchesOperationalCheck(
        template.questionnaireName,
        currentAssignment
      )
    });
  }

  const sortRows = rows => rows.sort((a, b) =>
    String(a.locationName).localeCompare(String(b.locationName)) ||
    String(a.unitNumber).localeCompare(String(b.unitNumber)) ||
    String(a.questionnaireName).localeCompare(String(b.questionnaireName))
  );
  const allOperationalRows = sortRows([...configuredIncomplete]);
  const scheduleDueRows = sortRows(configuredIncomplete.filter(item => item.scheduledToday));
  const reportAlignedRows = sortRows(configuredIncomplete.filter(item =>
    normalize(item.inServiceStatus) === 'IN-SERVICE' &&
    item.assignmentCompatible !== false &&
    !item.completedFromLastCompletedDateTime
  ));

  return {
    success: true,
    mode: 'READ_ONLY_INFERRED_OPERATIONAL_CHECK_PREVIEW',
    evaluatedAt: at.toISOString(),
    shiftKey: shiftWindow.shiftKey,
    operationalPattern: operationalPattern.source,
    sourceCounts: {
      questionnaireStates: states.length,
      dailyShifts: shifts.length,
      units: units.length,
      inferredOperationalAssignments: templates.size,
      currentStateMatches: currentStateMatchCount,
      completedCurrent: completedCurrentCount,
      notDueCurrent: notDueCurrentCount
    },
    hypotheses: {
      allConfiguredOperational: {
        rule: 'Recent unit/questionnaire assignment; missing state is incomplete.',
        recordCount: allOperationalRows.length,
        rows: allOperationalRows
      },
      scheduledTodayOnly: {
        rule: 'Recent assignment plus questionnaire schedule due for this shift date.',
        recordCount: scheduleDueRows.length,
        rows: scheduleDueRows
      },
      reportAligned: {
        rule: 'Configured operational check; exact In-Service status; current assignment compatible; no completion during active 07:00 shift.',
        recordCount: reportAlignedRows.length,
        rows: reportAlignedRows
      }
    },
    diagnostics: {
      unjoinedShiftIdCount: unjoinedShiftIds.size,
      unjoinedShiftIds: [...unjoinedShiftIds].slice(0, 25)
    },
    note: 'Historical state records are used only to infer expected operational assignments. No OperativeIQ, D1, or Google Sheets data was changed.'
  };
}

function completedDuringShift(value, shiftKey, nextShiftKey) {
  const text = String(value || '').trim();
  if (!text) return false;
  if (/[zZ]$|[+-]\d{2}:?\d{2}$/.test(text)) {
    const instant = new Date(text);
    return Number.isFinite(instant.getTime()) && activeEasternShift(instant).shiftKey === shiftKey;
  }
  const match = text.match(/^(\d{4}-\d{2}-\d{2})[T ](\d{1,2})/);
  if (!match) return false;
  const hour = Number(match[2]);
  return (match[1] === shiftKey && hour >= 7) ||
    (match[1] === nextShiftKey && hour < 7);
}

function assignmentMatchesOperationalCheck(questionnaireName, assignment) {
  const name = normalize(questionnaireName);
  const role = normalize(assignment);
  if (/UTV.*CHECK.?LIST/.test(name)) return true;
  if (!role) return false;
  if (/CHIEF OFFICER DAILY UNIT INSPECTION/.test(name)) return /(^|\s)(CHIEF|C)\s*4\d/.test(role);
  if (/BATTALION 40 DAILY CHECK/.test(name)) return /BATTALION\s*40|(^|\s)B\s*40/.test(role);
  if (/ADMIN BATTALION DAILY/.test(name)) return /TRAINING\s*40|SAFETY\s*40/.test(role);
  if (/MEDIC UNIT DAILY/.test(name)) return /(^|\s)(MEDIC|M)\s*\d/.test(role);
  if (/DAILY LADDER TRUCK INSPECTION/.test(name)) return /(^|\s)(LADDER|L)\s*\d/.test(role);
  if (/DAILY ENGINE/.test(name)) return /(^|\s)(ENGINE|E)\s*\d/.test(role);
  return null;
}

async function previewIncompleteChecks(env, requestedDate, compact = false) {
  const token = await getAccessToken(env);
  const reportDate = requestedDate || easternDateKey(new Date());
  const dailyShiftPath = '/api/daily-shifts?' + new URLSearchParams({
    '$select': [
      'id', 'shift', 'truckId', 'entryDate', 'entryTime', 'status', 'closed',
      'createdTime', 'lastModificationTime'
    ].join(','),
    '$orderby': 'entryDate desc,entryTime desc'
  }).toString();

  const [states, shifts, units, unitStatuses, unitLocations] = await Promise.all([
    fetchAll('/api/daily-shift-questionaries-state?$orderby=id desc', token, 5000),
    fetchAll(dailyShiftPath, token, 3000),
    fetchAll('/api/units', token, 500),
    fetchAll('/api/unit-statuses', token, 500),
    fetchAll('/api/unit-locations', token, 500)
  ]);

  const shiftsById = new Map(shifts.map(item => [String(item.id), item]));
  const unitsById = new Map(units.map(item => [String(item.id), item]));
  const statusesById = new Map(unitStatuses.map(item => [String(item.id), item]));
  const locationsById = new Map();
  for (const location of unitLocations) {
    for (const key of [location.id, location.roomId]) {
      if (key !== null && key !== undefined && key !== '') {
        locationsById.set(String(key), location);
      }
    }
  }

  const rows = [];
  const unjoinedShiftIds = new Set();
  for (const state of states) {
    const shift = shiftsById.get(String(state.shiftId));
    if (!shift) {
      unjoinedShiftIds.add(String(state.shiftId));
      continue;
    }
    if (dateKey(shift.entryDate) !== reportDate) continue;
    if (!normalizeBoolean(state.isScheduled)) continue;

    const unit = unitsById.get(String(shift.truckId)) || {};
    const locationKey = [unit.locationId, unit.roomId]
      .find(value => value !== null && value !== undefined && value !== '');
    const location = locationsById.get(String(locationKey ?? '')) || {};
    const serviceStatus =
      statusesById.get(String(unit.truckStatusId))?.truckStatusName ||
      unit.fleetStatus || unit.status || '';
    const currentState = state.currentState ?? '';
    rows.push({
      date: reportDate,
      locationName: location.locationName || location.locationDescription || shift.shift || '',
      unitNumber: unit.truckNumber || `Truck ID ${shift.truckId}`,
      inServiceStatus: serviceStatus,
      questionnaireName: state.questionaryName || '',
      status: incompleteStateLabel(currentState),
      incomplete: isIncompleteQuestionnaireState(currentState),
      stateId: state.id,
      shiftId: state.shiftId,
      truckId: shift.truckId,
      questionaryId: state.questionaryId,
      currentState,
      sourceStatus: state.status ?? '',
      schedulerType: state.schedulerType ?? null,
      schedulerSubType: state.schedulerSubType ?? null,
      dayValue: state.dayValue ?? null,
      monthValue: state.monthValue ?? null,
      weekValue: state.weekValue ?? null,
      sunday: state.sunday ?? null,
      monday: state.monday ?? null,
      tuesday: state.tuesday ?? null,
      wednesday: state.wednesday ?? null,
      thursday: state.thursday ?? null,
      friday: state.friday ?? null,
      saturday: state.saturday ?? null,
      startDate: state.startDate ?? null,
      endDate: state.endDate ?? null,
      wasCompletedLastShift: state.wasCompletedLastShift ?? null,
      lastCompletedDateTime: state.lastCompletedDateTime ?? null,
      shiftClosed: shift.closed ?? null,
      shiftStatus: shift.status ?? ''
    });
  }

  rows.sort((a, b) =>
    String(a.locationName).localeCompare(String(b.locationName)) ||
    String(a.unitNumber).localeCompare(String(b.unitNumber)) ||
    String(a.questionnaireName).localeCompare(String(b.questionnaireName))
  );
  const incompleteRows = rows.filter(item => item.incomplete);

  return {
    success: true,
    mode: 'READ_ONLY_INCOMPLETE_CHECK_PREVIEW',
    reportDate,
    sourceCounts: {
      questionnaireStates: states.length,
      dailyShifts: shifts.length,
      units: units.length,
      unitStatuses: unitStatuses.length,
      unitLocations: unitLocations.length
    },
    scheduledRowCount: rows.length,
    incompleteRowCount: incompleteRows.length,
    stateValueCounts: countValues(rows, 'currentState'),
    sourceStatusCounts: countValues(rows, 'sourceStatus'),
    incompleteRows,
    ...(compact ? {} : { scheduledRows: rows }),
    diagnostics: {
      unjoinedShiftIdCount: unjoinedShiftIds.size,
      unjoinedShiftIds: [...unjoinedShiftIds].slice(0, 25)
    },
    csvTargetColumns: [
      'Date', 'Location Name', 'Unit Number', 'In-Service Status',
      'Questionnaire Name', 'Status'
    ],
    note: 'Joined questionnaire states to daily shifts, units, statuses, and locations. No OperativeIQ or D1 data was changed.'
  };
}

async function previewCurrentIncompleteChecks(env, requestedInstant = null) {
  const at = requestedInstant || new Date();
  const shift = activeEasternShift(at);
  const source = await previewInferredOperationalChecks(env, at);
  const operationalPattern = operationalCheckPattern(env);
  const rows = (source.hypotheses?.reportAligned?.rows || [])
    .map(row => ({
      date: shift.shiftKey,
      locationName: row.locationName,
      unitNumber: row.unitNumber,
      inServiceStatus: row.inServiceStatus,
      questionnaireName: row.questionnaireName,
      status: 'Not Completed',
      stateId: row.currentStateId || row.inferredFromStateId,
      shiftId: row.currentShiftId || row.inferredFromShiftId,
      truckId: row.unitId,
      questionaryId: row.questionaryId,
      currentState: row.currentState,
      schedulerType: row.schedulerType,
      schedulerSubType: row.schedulerSubType ?? null,
      missingCurrentState: row.missingCurrentState,
      currentAssignment: row.currentAssignment
    }));

  rows.sort((a, b) =>
    String(a.locationName).localeCompare(String(b.locationName)) ||
    String(a.unitNumber).localeCompare(String(b.unitNumber)) ||
    String(a.questionnaireName).localeCompare(String(b.questionnaireName))
  );

  return {
    success: true,
    mode: 'READ_ONLY_CURRENT_SHIFT_OPERATIONAL_CHECKS',
    timezone: 'America/New_York',
    shiftChangeHour: 7,
    evaluatedAt: at.toISOString(),
    shiftKey: shift.shiftKey,
    shiftStartLabel: `${shift.shiftKey} 07:00 America/New_York`,
    nextShiftKey: shift.nextShiftKey,
    nextShiftStartLabel: `${shift.nextShiftKey} 07:00 America/New_York`,
    operationalPattern: operationalPattern.source,
    sourceScheduledCount: source.sourceCounts?.inferredOperationalAssignments || 0,
    recordCount: rows.length,
    columns: SHEET_HEADERS,
    rows,
    sheetRows: rows.map(sheetRowValues),
    diagnostics: source.diagnostics,
    note: 'Current 07:00 shift only; recent assignments are inferred from OperativeIQ history and reconciled with current D1 assignments. Completed, non-In-Service, stale-role, and non-operational checks are excluded. No D1 or Google Sheets data was changed.'
  };
}

async function syncIncompleteChecks(env) {
  if (!env.DB) throw new Error('D1 binding DB is not configured.');
  if (!normalizeBoolean(env.INCOMPLETE_CHECKS_D1_ENABLED)) {
    throw new Error('INCOMPLETE_CHECKS_D1_ENABLED must be true before D1 writes are allowed.');
  }

  await ensureIncompleteCheckTables(env);
  const startedAt = new Date().toISOString();
  const run = await env.DB.prepare(`
    INSERT INTO operative_incomplete_check_runs(started_at,status,mode)
    VALUES(?,'running','d1') RETURNING id
  `).bind(startedAt).first();

  try {
    const preview = await previewCurrentIncompleteChecks(env);
    const now = new Date().toISOString();
    const writes = [env.DB.prepare('DELETE FROM operative_incomplete_checks')];

    for (const row of preview.rows) {
      writes.push(env.DB.prepare(`
        INSERT INTO operative_incomplete_checks(
          shift_key,state_id,shift_id,truck_id,questionary_id,report_date,
          location_name,unit_number,in_service_status,questionnaire_name,
          check_status,last_seen_at
        ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)
      `).bind(
        preview.shiftKey,
        row.stateId,
        row.shiftId,
        row.truckId,
        row.questionaryId,
        row.date,
        row.locationName,
        row.unitNumber,
        row.inServiceStatus,
        row.questionnaireName,
        row.status,
        now
      ));
    }

    await env.DB.batch(writes);
    let sheetResult = null;
    if (normalizeBoolean(env.GOOGLE_SHEETS_EXPORT_ENABLED)) {
      sheetResult = await exportIncompleteChecksToSheets(env, preview.shiftKey);
    }

    await env.DB.prepare(`
      UPDATE operative_incomplete_check_runs
      SET completed_at=?,status='success',shift_key=?,record_count=?,
          sheets_exported=?,sheets_row_count=?
      WHERE id=?
    `).bind(
      new Date().toISOString(),
      preview.shiftKey,
      preview.recordCount,
      sheetResult ? 1 : 0,
      sheetResult?.rowCount || 0,
      run.id
    ).run();

    return {
      success: true,
      mode: 'D1_CURRENT_SHIFT_INCOMPLETE_CHECK_SYNC',
      shiftKey: preview.shiftKey,
      recordCount: preview.recordCount,
      sheetsExported: Boolean(sheetResult),
      sheetResult,
      rows: preview.rows,
      timestamp: now
    };
  } catch (error) {
    await env.DB.prepare(`
      UPDATE operative_incomplete_check_runs
      SET completed_at=?,status='failed',error_message=?
      WHERE id=?
    `).bind(new Date().toISOString(), errorMessage(error), run.id).run();
    throw error;
  }
}

async function exportIncompleteChecksToSheets(env, requestedShiftKey = '') {
  if (!env.DB) throw new Error('D1 binding DB is not configured.');
  if (!normalizeBoolean(env.GOOGLE_SHEETS_EXPORT_ENABLED)) {
    throw new Error('GOOGLE_SHEETS_EXPORT_ENABLED must be true before Google Sheets writes are allowed.');
  }
  validateGoogleSheetsConfiguration(env);

  const shiftKey = requestedShiftKey || activeEasternShift(new Date()).shiftKey;
  const result = await env.DB.prepare(`
    SELECT report_date,location_name,unit_number,in_service_status,
           questionnaire_name,check_status
    FROM operative_incomplete_checks
    WHERE shift_key=?
    ORDER BY location_name,unit_number,questionnaire_name
  `).bind(shiftKey).all();
  const values = [
    SHEET_HEADERS,
    ...(result.results || []).map(row => [
      displayDate(row.report_date),
      row.location_name,
      row.unit_number,
      row.in_service_status,
      row.questionnaire_name,
      row.check_status
    ])
  ];
  const token = await getGoogleAccessToken(env);
  const spreadsheetId = String(env.GOOGLE_SHEETS_SPREADSHEET_ID).trim();
  const tabName = String(env.GOOGLE_SHEETS_TAB_NAME || 'Incomplete Daily Checks').trim();
  const range = `'${tabName.replace(/'/g, "''")}'!A:F`;
  const encodedRange = encodeURIComponent(range);
  const base = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${encodedRange}`;

  const clearResponse = await fetch(`${base}:clear`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: '{}'
  });
  const clearText = await clearResponse.text();
  if (!clearResponse.ok) {
    throw new Error(`Google Sheets clear failed (${clearResponse.status}): ${safeApiError(clearText)}`);
  }

  const updateResponse = await fetch(`${base}?valueInputOption=RAW`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ range, majorDimension: 'ROWS', values })
  });
  const updateText = await updateResponse.text();
  if (!updateResponse.ok) {
    throw new Error(`Google Sheets update failed (${updateResponse.status}): ${safeApiError(updateText)}`);
  }

  return {
    success: true,
    mode: 'GOOGLE_SHEETS_INCOMPLETE_CHECK_EXPORT',
    shiftKey,
    spreadsheetId,
    tabName,
    rowCount: Math.max(0, values.length - 1),
    updatedRange: JSON.parse(updateText)?.updatedRange || range,
    timestamp: new Date().toISOString()
  };
}

async function exportOpenServiceTicketsToSheets(env) {
  if (!normalizeBoolean(env.OPEN_SERVICE_TICKETS_SHEETS_EXPORT_ENABLED)) {
    throw new Error('OPEN_SERVICE_TICKETS_SHEETS_EXPORT_ENABLED must be true before Google Sheets writes are allowed.');
  }
  if (!String(env.OPERATIVE_SERVICE_TICKETS_PATH || '').trim()) {
    throw new Error('OPERATIVE_SERVICE_TICKETS_PATH must be set to the verified resource before scheduled Google Sheets exports are enabled.');
  }
  validateGoogleSheetsConfiguration(env, 'OPEN_SERVICE_TICKETS_SPREADSHEET_ID');

  const preview = await previewOpenServiceTickets(env);
  const values = [
    SERVICE_TICKET_SHEET_HEADERS,
    ...preview.rows.map(row => [
      row.created,
      row.assetDescription,
      row.ticketName,
      row.unitName,
      row.description,
      row.status
    ])
  ];
  const token = await getGoogleAccessToken(env);
  const spreadsheetId = String(env.OPEN_SERVICE_TICKETS_SPREADSHEET_ID).trim();
  const tabName = String(env.OPEN_SERVICE_TICKETS_TAB_NAME || 'Open Service Tickets').trim();
  const range = `'${tabName.replace(/'/g, "''")}'!A:F`;
  const encodedRange = encodeURIComponent(range);
  const base = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${encodedRange}`;

  const clearResponse = await fetch(`${base}:clear`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: '{}'
  });
  const clearText = await clearResponse.text();
  if (!clearResponse.ok) {
    throw new Error(`Google Sheets clear failed (${clearResponse.status}): ${safeApiError(clearText)}`);
  }

  const updateResponse = await fetch(`${base}?valueInputOption=RAW`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ range, majorDimension: 'ROWS', values })
  });
  const updateText = await updateResponse.text();
  if (!updateResponse.ok) {
    throw new Error(`Google Sheets update failed (${updateResponse.status}): ${safeApiError(updateText)}`);
  }

  return {
    success: true,
    mode: 'GOOGLE_SHEETS_OPEN_SERVICE_TICKET_EXPORT',
    endpoint: preview.endpoint,
    spreadsheetId,
    tabName,
    rowCount: preview.recordCount,
    updatedRange: JSON.parse(updateText)?.updatedRange || range,
    timestamp: new Date().toISOString()
  };
}

async function ensureIncompleteCheckTables(env) {
  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS operative_incomplete_checks (
      shift_key TEXT NOT NULL,
      state_id INTEGER NOT NULL,
      shift_id INTEGER,
      truck_id INTEGER,
      questionary_id INTEGER,
      report_date TEXT NOT NULL,
      location_name TEXT NOT NULL,
      unit_number TEXT NOT NULL,
      in_service_status TEXT NOT NULL,
      questionnaire_name TEXT NOT NULL,
      check_status TEXT NOT NULL,
      last_seen_at TEXT NOT NULL,
      PRIMARY KEY (shift_key,state_id)
    )
  `).run();
  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS operative_incomplete_check_runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      started_at TEXT NOT NULL,
      completed_at TEXT,
      status TEXT NOT NULL,
      mode TEXT NOT NULL,
      shift_key TEXT,
      record_count INTEGER NOT NULL DEFAULT 0,
      sheets_exported INTEGER NOT NULL DEFAULT 0,
      sheets_row_count INTEGER NOT NULL DEFAULT 0,
      error_message TEXT
    )
  `).run();
}

function operationalCheckPattern(env) {
  const source = String(env.OPERATIVE_OPERATIONAL_CHECK_PATTERN || DEFAULT_OPERATIONAL_CHECK_PATTERN).trim();
  try {
    return new RegExp(source, 'i');
  } catch (error) {
    throw new Error(`OPERATIVE_OPERATIONAL_CHECK_PATTERN is invalid: ${errorMessage(error)}`);
  }
}

function assignedOnShiftDate(row, shiftKey) {
  const schedulerType = Number(row.schedulerType);
  if (schedulerType === 1) return true;
  if (schedulerType === 2) {
    const weekday = easternWeekdayFromDateKey(shiftKey);
    return normalizeBoolean(row[weekday]);
  }

  // Operational questionnaires with an explicit daily name remain supported if
  // OperativeIQ omits scheduler metadata. Other schedules are excluded rather
  // than accidentally carrying them into the next 07:00 shift.
  return !Number.isFinite(schedulerType) && /\bdaily\b/i.test(String(row.questionnaireName || ''));
}

function activeEasternShift(date) {
  const parts = easternParts(date);
  const localDateKey = `${parts.year}-${parts.month}-${parts.day}`;
  const shiftKey = Number(parts.hour) < 7 ? addDaysToDateKey(localDateKey, -1) : localDateKey;
  return { shiftKey, nextShiftKey: addDaysToDateKey(shiftKey, 1) };
}

function easternParts(date) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23'
  }).formatToParts(date);
  return Object.fromEntries(parts.map(item => [item.type, item.value]));
}

function addDaysToDateKey(value, days) {
  const [year, month, day] = String(value).split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return date.toISOString().slice(0, 10);
}

function easternWeekdayFromDateKey(value) {
  const [year, month, day] = String(value).split('-').map(Number);
  return ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][
    new Date(Date.UTC(year, month - 1, day, 12)).getUTCDay()
  ];
}

function validatedInstantParameter(value) {
  const text = String(value || '').trim();
  if (!text) return null;
  const instant = new Date(text);
  if (!Number.isFinite(instant.getTime())) {
    throw new Error('The at parameter must be a valid ISO timestamp.');
  }
  return instant;
}

function sheetRowValues(row) {
  return [
    displayDate(row.date), row.locationName, row.unitNumber,
    row.inServiceStatus, row.questionnaireName, row.status
  ];
}

function displayDate(value) {
  const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return match ? `${Number(match[2])}/${Number(match[3])}/${match[1]}` : String(value || '');
}

async function loadSwagger(env, existingToken = null, requirePaths = true) {
  const token = existingToken || await getAccessToken(env);
  const attempts = [];
  for (const path of SWAGGER_CANDIDATES) {
    const response = await fetch(RESOURCE_ROOT + path, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' }
    });
    const text = await response.text();
    attempts.push({ path, status: response.status });
    if (!response.ok) continue;
    try {
      const specification = JSON.parse(text);
      const pathCount = Object.keys(specification.paths || {}).length;
      const schemas = specification.components?.schemas || specification.definitions || {};
      if (pathCount || (!requirePaths && Object.keys(schemas).length)) {
        return { specification, swaggerPath: path, attempts };
      }
    } catch (_error) {
      // Continue to the next documented Swagger location.
    }
  }
  throw new Error(`No supported Swagger JSON document was found: ${JSON.stringify(attempts)}`);
}

function validatedDateParameter(value) {
  const text = String(value || '').trim();
  if (!text) return '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    throw new Error('The date parameter must use YYYY-MM-DD.');
  }
  return text;
}

function validatedPositiveIntegerParameter(value, name) {
  const text = String(value || '').trim();
  if (!/^\d+$/.test(text) || Number(text) <= 0) {
    throw new Error(`${name} must be a positive integer.`);
  }
  return Number(text);
}

function easternDateKey(date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(item => [item.type, item.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function dateKey(value) {
  const text = String(value || '').trim();
  const iso = text.match(/\d{4}-\d{2}-\d{2}/);
  if (iso) return iso[0];
  const us = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (us) return `${us[3]}-${us[1].padStart(2, '0')}-${us[2].padStart(2, '0')}`;
  const millis = new Date(text.replace(/^[A-Za-z]+,\s*/, '')).getTime();
  if (Number.isFinite(millis)) return easternDateKey(new Date(millis));
  return '';
}

function dynamicViewDateKey(value) {
  const text = String(value || '').trim();
  if (!text) return '';

  // Preserve true date-only values. Convert timestamps to the report's
  // America/New_York calendar date so the Sheet matches OperativeIQ.
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  const millis = new Date(text).getTime();
  if (Number.isFinite(millis)) return easternDateKey(new Date(millis));
  return dateKey(text);
}

function isIncompleteQuestionnaireState(value) {
  const state = normalize(value);
  if (!state) return false;
  if (['1', '2'].includes(state)) return true;
  if (['0', '3'].includes(state)) return false;
  if (/NOT.?COMPLET|INCOMPLETE|PENDING|MISSED|OVERDUE/.test(state)) return true;
  if (/COMPLETED|COMPLETE|DONE|PASSED/.test(state)) return false;
  return ['FALSE', 'NO'].includes(state);
}

function incompleteStateLabel(value) {
  const state = normalize(value);
  if (isIncompleteQuestionnaireState(value)) return 'Not Completed';
  if (state === '3') return 'Completed';
  if (state === '0') return 'Not Due';
  return String(value ?? '').trim();
}

function countValues(rows, field) {
  const counts = {};
  for (const row of rows) {
    const key = String(row[field] ?? '').trim() || '(blank)';
    counts[key] = (counts[key] || 0) + 1;
  }
  return counts;
}

function responseModelNames(operation) {
  const names = new Set();
  for (const response of Object.values(operation?.responses || {})) {
    const candidates = [
      response?.schema?.$ref,
      response?.schema?.items?.$ref,
      response?.content?.['application/json']?.schema?.$ref,
      response?.content?.['application/json']?.schema?.items?.$ref
    ];
    for (const value of candidates) {
      if (value) names.add(String(value).split('/').pop());
    }
  }
  return [...names];
}

function redactDiscoverySample(source) {
  const result = {};
  for (const [key, value] of Object.entries(source || {})) {
    if (/token|secret|password|credential/i.test(key)) {
      result[key] = '[REDACTED]';
    } else if (value === null || ['string', 'number', 'boolean'].includes(typeof value)) {
      result[key] = value;
    } else if (Array.isArray(value)) {
      result[key] = `[Array(${value.length})]`;
    } else {
      result[key] = '[Object]';
    }
  }
  return result;
}

async function previewLiveAssignments(env) {
  if (!env.DB) throw new Error('D1 binding DB is not configured.');
  const token = await getAccessToken(env);
  const dailyShiftPath = '/api/daily-shifts?' + new URLSearchParams({
    '$select': [
      'id', 'shift', 'truckId', 'entryDate', 'entryTime', 'crewId', 'locked',
      'status', 'lastModificationTime', 'createdTime', 'closed', 'callSignId'
    ].join(','),
    '$orderby': 'entryDate desc,entryTime desc'
  }).toString();

  const [units, callSigns, unitStatuses, dailyShifts, vehiclesResult] = await Promise.all([
    fetchAll('/api/units?$select=id,truckNumber,status,truckStatusId,fleetStatus', token, 500),
    fetchAll('/api/call-signs?$select=id,description,status', token, 500),
    fetchAll('/api/unit-statuses?$select=id,truckStatusName,status', token, 500),
    fetchAll(dailyShiftPath, token, 1000),
    env.DB.prepare(`
      SELECT apparatus_number,primary_assignment,current_assignment,fleet_active,dashboard_visible
      FROM vehicles
      ORDER BY apparatus_number
    `).all()
  ]);

  const unitsById = new Map(units.map(unit => [String(unit.id), unit]));
  const callSignsById = new Map(callSigns.map(item => [String(item.id), item]));
  const unitStatusesById = new Map(unitStatuses.map(item => [String(item.id), item]));
  const latestByApparatus = new Map();
  const warnings = [];
  let joinedCount = 0;

  for (const shift of dailyShifts) {
    const unit = unitsById.get(String(shift.truckId));
    const callSign = callSignsById.get(String(shift.callSignId));
    if (!unit || !callSign) continue;
    const apparatus = apparatusNumber(unit.truckNumber);
    if (!apparatus || IGNORED_APPARATUS.has(apparatus)) continue;
    joinedCount += 1;
    const record = {
      apparatusNumber: apparatus,
      truckId: shift.truckId,
      truckNumber: unit.truckNumber,
      callSignId: shift.callSignId,
      callSign: normalizeCallSign(callSign.description),
      shiftId: shift.id,
      shiftName: shift.shift,
      entryDate: shift.entryDate,
      entryTime: shift.entryTime,
      createdTime: shift.createdTime,
      lastModificationTime: shift.lastModificationTime,
      status: shift.status,
      closed: shift.closed,
      shiftOpen: !normalizeBoolean(shift.closed),
      unitServiceStatus:
        unitStatusesById.get(String(unit.truckStatusId))?.truckStatusName ||
        unit.fleetStatus ||
        '',
      timestampMillis: dailyShiftMillis(shift)
    };
    const current = latestByApparatus.get(apparatus);
    if (!current || newerJoinedAssignment(record, current)) {
      latestByApparatus.set(apparatus, record);
    }
  }

  const configured = new Map(
    (vehiclesResult.results || []).map(row => [String(row.apparatus_number).toUpperCase(), row])
  );
  const assignments = [...latestByApparatus.values()]
    .sort((a, b) => a.apparatusNumber.localeCompare(b.apparatusNumber));
  const newestAssignmentMillis = assignments.reduce(
    (maximum, item) => Math.max(maximum, item.timestampMillis || 0),
    0
  );
  const freshCutoffMillis = newestAssignmentMillis - (72 * 60 * 60 * 1000);
  const differences = [];

  for (const assignment of assignments) {
    assignment.fresh = assignment.timestampMillis >= freshCutoffMillis;
    assignment.unitServiceClass = statusClass(assignment.unitServiceStatus);
  }

  const callSignOwners = new Map();
  for (const assignment of assignments) {
    if (!assignment.fresh || !assignmentKey(assignment.callSign)) continue;
    const key = assignmentKey(assignment.callSign);
    const currentOwner = callSignOwners.get(key);
    if (!currentOwner || strongerCallSignOwner(assignment, currentOwner)) {
      callSignOwners.set(key, assignment);
    }
  }

  for (const assignment of assignments) {
    assignment.isCallSignOwner =
      callSignOwners.get(assignmentKey(assignment.callSign)) === assignment;
    const vehicle = configured.get(assignment.apparatusNumber);
    if (!vehicle) {
      warnings.push(`${assignment.apparatusNumber} is not present in D1 vehicles.`);
      continue;
    }
    const current = vehicle.current_assignment || vehicle.primary_assignment || '';
    const proposed = proposedAssignment(assignment, current);
    assignment.currentAssignment = current;
    assignment.proposedAssignment = proposed;
    if (!proposed) continue;
    if (assignmentKey(current) !== assignmentKey(proposed)) {
      differences.push({
        apparatusNumber: assignment.apparatusNumber,
        currentAssignment: current,
        proposedAssignment: proposed,
        shiftOpen: assignment.shiftOpen,
        unitServiceStatus: assignment.unitServiceStatus,
        unitServiceClass: assignment.unitServiceClass,
        shiftId: assignment.shiftId,
        entryDate: assignment.entryDate,
        entryTime: assignment.entryTime,
        reason: assignment.unitServiceClass === 'inactive'
          ? 'Unit unavailable'
          : assignment.isCallSignOwner
            ? 'Newest active call-sign owner'
            : 'Call sign reassigned to another apparatus'
      });
    }
  }

  return {
    success: true,
    mode: 'JOINED_ASSIGNMENT_PREVIEW_ONLY',
    sourceCounts: {
      units: units.length,
      callSigns: callSigns.length,
      unitStatuses: unitStatuses.length,
      dailyShifts: dailyShifts.length,
      joinedDailyShifts: joinedCount
    },
    assignmentCount: assignments.length,
    freshnessHours: 72,
    newestAssignmentMillis,
    assignments,
    differences,
    warnings,
    note: 'Joined truckId to units and callSignId to call signs. No D1 data was changed.'
  };
}

function strongerCallSignOwner(candidate, current) {
  const rank = assignment => {
    if (assignment.unitServiceClass === 'active') return 3;
    if (assignment.unitServiceClass === 'unknown') return 2;
    return 1;
  };
  const rankDifference = rank(candidate) - rank(current);
  if (rankDifference !== 0) return rankDifference > 0;
  return newerJoinedAssignment(candidate, current);
}

function proposedAssignment(assignment, currentAssignment) {
  if (assignment.unitServiceClass === 'inactive') {
    return `Vehicle ${assignment.apparatusNumber}`;
  }
  if (!assignment.fresh) return null;
  if (assignment.isCallSignOwner) return assignment.callSign;
  if (assignmentKey(currentAssignment) === assignmentKey(assignment.callSign)) {
    return `Vehicle ${assignment.apparatusNumber}`;
  }
  return null;
}

async function applyLiveAssignments(env) {
  await ensureOperativeTables(env);
  const startedAt = new Date().toISOString();
  const run = await env.DB.prepare(`
    INSERT INTO operative_sync_runs(started_at,mode,status)
    VALUES(?,'live','running') RETURNING id
  `).bind(startedAt).first();

  try {
    const preview = await previewLiveAssignments(env);
    const now = new Date().toISOString();
    const writes = [];
    let changedCount = 0;

    for (const assignment of preview.assignments) {
      if (!assignment.currentAssignment) continue;
      const changed = assignment.proposedAssignment &&
        assignmentKey(assignment.currentAssignment) !== assignmentKey(assignment.proposedAssignment);
      if (changed) {
        changedCount += 1;
        writes.push(env.DB.prepare(`
          UPDATE vehicles
          SET current_assignment=?,updated_at=?
          WHERE apparatus_number=?
        `).bind(assignment.proposedAssignment, now, assignment.apparatusNumber));
      }

      writes.push(env.DB.prepare(`
        INSERT INTO operative_assignment_state(
          apparatus_number,operative_unit_number,call_sign,created_at,shift_id,
          service_status,last_seen_at,accepted
        ) VALUES(?,?,?,?,?,?,?,?)
        ON CONFLICT(apparatus_number) DO UPDATE SET
          operative_unit_number=excluded.operative_unit_number,
          call_sign=excluded.call_sign,
          created_at=excluded.created_at,
          shift_id=excluded.shift_id,
          service_status=excluded.service_status,
          last_seen_at=excluded.last_seen_at,
          accepted=excluded.accepted
      `).bind(
        assignment.apparatusNumber,
        assignment.truckNumber,
        assignment.callSign,
        assignment.entryDate || assignment.createdTime || '',
        assignment.shiftId,
        assignment.unitServiceStatus,
        now,
        assignment.proposedAssignment ? 1 : 0
      ));
    }

    if (writes.length) await env.DB.batch(writes);
    await env.DB.prepare(`
      UPDATE operative_sync_runs
      SET completed_at=?,status='success',record_count=?,difference_count=?,warnings_json=?
      WHERE id=?
    `).bind(
      new Date().toISOString(),
      preview.assignmentCount,
      changedCount,
      JSON.stringify(preview.warnings || []),
      run.id
    ).run();

    return {
      success: true,
      mode: 'LIVE_D1_ASSIGNMENT_SYNC',
      changedCount,
      changes: preview.differences,
      warnings: preview.warnings,
      timestamp: now
    };
  } catch (error) {
    await env.DB.prepare(`
      UPDATE operative_sync_runs
      SET completed_at=?,status='failed',error_message=?
      WHERE id=?
    `).bind(new Date().toISOString(), errorMessage(error), run.id).run();
    throw error;
  }
}

async function ensureOperativeTables(env) {
  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS operative_assignment_state (
      apparatus_number TEXT PRIMARY KEY,
      operative_unit_number TEXT,
      call_sign TEXT NOT NULL,
      created_at TEXT,
      shift_id INTEGER,
      service_status TEXT,
      last_seen_at TEXT NOT NULL,
      accepted INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (apparatus_number) REFERENCES vehicles(apparatus_number)
    )
  `).run();
  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS operative_sync_runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      started_at TEXT NOT NULL,
      completed_at TEXT,
      mode TEXT NOT NULL DEFAULT 'preview',
      status TEXT NOT NULL,
      endpoint TEXT,
      record_count INTEGER NOT NULL DEFAULT 0,
      difference_count INTEGER NOT NULL DEFAULT 0,
      warnings_json TEXT,
      error_message TEXT
    )
  `).run();
}

function activeDailyShift(shift) {
  if (normalizeBoolean(shift.closed)) return false;
  const status = normalize(shift.status);
  return !['0', 'INACTIVE', 'CLOSED', 'DELETED', 'CANCELLED', 'CANCELED'].includes(status);
}

function dailyShiftMillis(shift) {
  const dateText = String(shift.entryDate || '').trim();
  const timeText = String(shift.entryTime || '').trim();
  const dateMatch = dateText.match(/\d{4}-\d{2}-\d{2}/);
  const timeMatch = timeText.match(/\d{1,2}:\d{2}(?::\d{2}(?:\.\d+)?)?/);
  if (dateMatch && timeMatch) {
    const normalizedTime = timeMatch[0].split('.')[0].padStart(8, '0');
    const combined = new Date(`${dateMatch[0]}T${normalizedTime}`).getTime();
    if (Number.isFinite(combined)) return combined;
  }
  for (const value of [shift.entryDate, shift.lastModificationTime, shift.createdTime]) {
    const millis = new Date(value || 0).getTime();
    if (Number.isFinite(millis)) return millis;
  }
  return 0;
}

function newerJoinedAssignment(candidate, current) {
  if (candidate.timestampMillis !== current.timestampMillis) {
    return candidate.timestampMillis > current.timestampMillis;
  }
  return Number(candidate.shiftId || 0) > Number(current.shiftId || 0);
}

function authorized(request, env) {
  return Boolean(env.SYNC_ADMIN_TOKEN) &&
    request.headers.get('Authorization') === `Bearer ${env.SYNC_ADMIN_TOKEN}`;
}

async function probeLinkageResources(env) {
  const token = await getAccessToken(env);
  const availableResources = [];
  const statusCounts = {};

  for (const path of LINKAGE_RESOURCE_CANDIDATES) {
    const url = new URL(RESOURCE_ROOT + path);
    url.searchParams.set('$top', '1');
    url.searchParams.set('$skip', '0');
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' }
    });
    const text = await response.text();
    statusCounts[response.status] = (statusCounts[response.status] || 0) + 1;
    if (response.status === 404) continue;

    const result = {
      path,
      status: response.status,
      overallCount: numericHeader(response.headers.get('X-Overall-Count'))
    };
    if (response.ok) {
      try {
        const records = arrayPayload(JSON.parse(text));
        result.returnedCount = records.length;
        result.fields = Object.keys(records[0] || {});
      } catch (error) {
        result.parseError = errorMessage(error);
      }
    } else {
      result.error = safeApiError(text);
    }
    availableResources.push(result);
  }

  return {
    success: true,
    mode: 'READ_ONLY_LINKAGE_PROBE',
    testedCount: LINKAGE_RESOURCE_CANDIDATES.length,
    statusCounts,
    availableResources,
    note: 'Only non-404 resources are returned. No D1 data was changed.'
  };
}

async function probeAssignmentResources(env) {
  const token = await getAccessToken(env);
  const results = [];

  for (const path of ASSIGNMENT_RESOURCE_CANDIDATES) {
    const url = new URL(RESOURCE_ROOT + path);
    url.searchParams.set('$top', '1');
    url.searchParams.set('$skip', '0');
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' }
    });
    const text = await response.text();
    const result = {
      path,
      status: response.status,
      overallCount: numericHeader(response.headers.get('X-Overall-Count'))
    };

    if (response.ok) {
      try {
        const records = arrayPayload(JSON.parse(text));
        result.returnedCount = records.length;
        result.fields = Object.keys(records[0] || {});
      } catch (error) {
        result.parseError = errorMessage(error);
      }
    } else if (response.status !== 404) {
      result.error = safeApiError(text);
    }

    results.push(result);
  }

  return {
    success: true,
    mode: 'READ_ONLY_PROBE',
    testedCount: results.length,
    availableResources: results.filter(item => item.status !== 404),
    results,
    note: 'Each candidate was requested with $top=1. No D1 data was changed.'
  };
}

function numericHeader(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

async function inspectSwagger(env, searchText, compact) {
  const token = await getAccessToken(env);
  const attempts = [];

  for (const path of SWAGGER_CANDIDATES) {
    const response = await fetch(RESOURCE_ROOT + path, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json'
      }
    });
    const text = await response.text();
    attempts.push({ path, status: response.status, contentType: response.headers.get('content-type') || '' });

    if (!response.ok) continue;

    let specification;
    try {
      specification = JSON.parse(text);
    } catch (_error) {
      continue;
    }

    const paths = Object.entries(specification.paths || {})
      .map(([apiPath, methods]) => ({
        path: apiPath,
        operations: Object.entries(methods || {})
          .filter(([method]) => /^(get|post)$/i.test(method))
          .map(([method, operation]) => ({
            method: method.toUpperCase(),
            operationId: operation?.operationId || '',
            summary: operation?.summary || '',
            tags: operation?.tags || []
          }))
      }))
      .filter(item => item.operations.length);
    const assignmentPattern = /unit|call.?sign|assign|apparatus|vehicle|service.?status|fleet|shift/i;
    const candidatePaths = paths.filter(item => assignmentPattern.test(JSON.stringify(item)));
    const query = String(searchText || '').trim().toLowerCase();
    const searchedPaths = query
      ? paths.filter(item => JSON.stringify(item).toLowerCase().includes(query))
      : candidatePaths;
    attempts[attempts.length - 1].topLevelKeys = Object.keys(specification);
    attempts[attempts.length - 1].resourceCount = paths.length;

    // Some OperativeIQ Swagger locations return a valid but empty document.
    // Keep searching instead of treating the first HTTP 200 as authoritative.
    if (!paths.length) continue;

    if (compact) {
      return {
        success: true,
        swaggerPath: path,
        title: specification.info?.title || '',
        version: specification.info?.version || '',
        query,
        totalResourceCount: paths.length,
        matchCount: searchedPaths.length,
        resourcePaths: searchedPaths
      };
    }

    return {
      success: true,
      swaggerPath: path,
      title: specification.info?.title || '',
      version: specification.info?.version || '',
      candidatePaths: searchedPaths,
      allResourcePaths: paths,
      attempts
    };
  }

  return {
    success: false,
    message: 'No supported Swagger JSON document was found.',
    attempts
  };
}

async function previewAssignments(env, endpoint) {
  if (!env.DB) throw new Error('D1 binding DB is not configured.');

  const token = await getAccessToken(env);
  const sourceRecords = await fetchAll(endpoint, token);
  const normalized = sourceRecords.map(normalizeRecord).filter(record => record.apparatusNumber);
  const latest = newestPerVehicle(normalized);
  const vehiclesResult = await env.DB.prepare(`
    SELECT apparatus_number,primary_assignment,current_assignment,fleet_active,dashboard_visible
    FROM vehicles
    ORDER BY apparatus_number
  `).all();
  const configured = new Map(
    (vehiclesResult.results || []).map(row => [String(row.apparatus_number).toUpperCase(), row])
  );
  const differences = [];
  const warnings = [];

  for (const record of latest.values()) {
    if (IGNORED_APPARATUS.has(record.apparatusNumber)) continue;
    const vehicle = configured.get(record.apparatusNumber);
    if (!vehicle) {
      warnings.push(`${record.apparatusNumber} is not present in D1 vehicles.`);
      continue;
    }

    const current = vehicle.current_assignment || vehicle.primary_assignment || '';
    const status = statusClass(record.serviceStatus);
    const proposed = status === 'inactive'
      ? `Vehicle ${record.apparatusNumber}`
      : record.callSign;

    if (status === 'unknown') {
      warnings.push(`${record.apparatusNumber} has unknown service status: ${record.serviceStatus || '(blank)'}`);
    }

    if (assignmentKey(current) !== assignmentKey(proposed)) {
      differences.push({
        apparatusNumber: record.apparatusNumber,
        currentAssignment: current,
        proposedAssignment: proposed,
        serviceStatus: record.serviceStatus,
        createdDate: record.createdDate,
        shiftId: record.shiftId
      });
    }
  }

  const sample = sourceRecords[0] || {};
  return {
    success: true,
    mode: 'PREVIEW_ONLY',
    endpoint,
    sourceRecordCount: sourceRecords.length,
    normalizedRecordCount: normalized.length,
    vehiclesConsidered: latest.size,
    differences,
    warnings,
    detectedSourceFields: Object.keys(sample),
    note: 'No D1 assignments were changed.'
  };
}

function validateGoogleSheetsConfiguration(env, spreadsheetVariable = 'GOOGLE_SHEETS_SPREADSHEET_ID') {
  for (const name of [
    'GOOGLE_SERVICE_ACCOUNT_EMAIL',
    'GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY',
    spreadsheetVariable
  ]) {
    if (!String(env[name] || '').trim()) throw new Error(`${name} is not configured.`);
  }
}

function validateGoogleServiceAccountConfiguration(env) {
  for (const name of [
    'GOOGLE_SERVICE_ACCOUNT_EMAIL',
    'GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY'
  ]) {
    if (!String(env[name] || '').trim()) throw new Error(`${name} is not configured.`);
  }
}

async function getGoogleAccessToken(env) {
  validateGoogleServiceAccountConfiguration(env);
  const now = Date.now();
  if (cachedGoogleToken && now < cachedGoogleTokenExpiresAt - 60000) {
    return cachedGoogleToken;
  }

  const issuedAt = Math.floor(now / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const claim = {
    iss: String(env.GOOGLE_SERVICE_ACCOUNT_EMAIL).trim(),
    scope: 'https://www.googleapis.com/auth/spreadsheets',
    aud: 'https://oauth2.googleapis.com/token',
    iat: issuedAt,
    exp: issuedAt + 3600
  };
  const unsigned = `${base64UrlJson(header)}.${base64UrlJson(claim)}`;
  const privateKey = await crypto.subtle.importKey(
    'pkcs8',
    pemPrivateKeyBytes(env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    privateKey,
    new TextEncoder().encode(unsigned)
  );
  const assertion = `${unsigned}.${base64UrlBytes(new Uint8Array(signature))}`;
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion
    })
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Google authorization failed (${response.status}): ${safeApiError(text)}`);
  }
  const payload = JSON.parse(text);
  if (!payload.access_token) throw new Error('Google authorization response did not include access_token.');
  cachedGoogleToken = payload.access_token;
  cachedGoogleTokenExpiresAt = now + Math.max(60, Number(payload.expires_in || 3600)) * 1000;
  return cachedGoogleToken;
}

function base64UrlJson(value) {
  return base64UrlBytes(new TextEncoder().encode(JSON.stringify(value)));
}

function base64UrlBytes(bytes) {
  let binary = '';
  for (let index = 0; index < bytes.length; index += 1) {
    binary += String.fromCharCode(bytes[index]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function pemPrivateKeyBytes(value) {
  const pem = String(value || '').replace(/\\n/g, '\n').trim();
  const base64 = pem
    .replace(/-----BEGIN PRIVATE KEY-----/g, '')
    .replace(/-----END PRIVATE KEY-----/g, '')
    .replace(/\s+/g, '');
  if (!base64) throw new Error('GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY is invalid.');
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes.buffer;
}

async function getAccessToken(env) {
  if (!env.OPERATIVE_CLIENT_ID) throw new Error('OPERATIVE_CLIENT_ID is not configured.');
  if (!env.OPERATIVE_CLIENT_SECRET) throw new Error('OPERATIVE_CLIENT_SECRET is not configured.');

  const now = Date.now();
  if (cachedToken && now < cachedTokenExpiresAt - 60000) return cachedToken;

  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: env.OPERATIVE_CLIENT_ID,
    client_secret: env.OPERATIVE_CLIENT_SECRET
  });
  const response = await fetch(AUTH_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json'
    },
    body
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`OperativeIQ authorization failed (${response.status}): ${safeApiError(text)}`);

  const payload = JSON.parse(text);
  if (!payload.access_token) throw new Error('OperativeIQ authorization response did not include access_token.');
  cachedToken = payload.access_token;
  cachedTokenExpiresAt = now + Math.max(60, Number(payload.expires_in || 3600)) * 1000;
  return cachedToken;
}

async function fetchAll(endpoint, token, maxRecords = 20000) {
  const records = [];
  let skip = 0;
  let overall = null;

  while (true) {
    const url = new URL(RESOURCE_ROOT + endpoint);
    if (!url.searchParams.has('$top')) url.searchParams.set('$top', String(PAGE_SIZE));
    url.searchParams.set('$skip', String(skip));

    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' }
    });
    const text = await response.text();
    if (!response.ok) throw new Error(`OperativeIQ resource request failed (${response.status}): ${safeApiError(text)}`);

    const payload = JSON.parse(text);
    const page = arrayPayload(payload);
    records.push(...page);
    const headerTotal = Number(response.headers.get('X-Overall-Count'));
    if (Number.isFinite(headerTotal)) overall = headerTotal;
    if (!page.length || page.length < PAGE_SIZE || records.length >= maxRecords) break;
    skip += page.length;
    if (skip > maxRecords) throw new Error(`OperativeIQ pagination exceeded the ${maxRecords}-record safety limit.`);
  }

  return records.slice(0, maxRecords);
}

function arrayPayload(payload) {
  if (Array.isArray(payload)) return payload;
  for (const key of ['value', 'data', 'results', 'items']) {
    if (Array.isArray(payload?.[key])) return payload[key];
  }
  throw new Error('OperativeIQ resource response did not contain a recognized record array.');
}

function normalizeRecord(source) {
  const unitNumber = stringField(source, ['unitNumber', 'UnitNumber', 'unit_number', 'Unit Number']);
  const callSign = normalizeCallSign(stringField(source, ['callSign', 'CallSign', 'call_sign', 'Call Sign']));
  const unitStatus = stringField(source, ['unitServiceStatus', 'UnitServiceStatus', 'unit_service_status', 'Unit Service Status']);
  const currentStatus = stringField(source, ['currentStatus', 'CurrentStatus', 'current_status', 'Current Status']);
  const createdDate = stringField(source, ['createdDate', 'CreatedDate', 'created_at', 'created_date', 'Created Date']);
  const shiftText = stringField(source, ['shiftId', 'ShiftId', 'shiftID', 'shift_id', 'Shift ID']);
  const shiftId = shiftText ? Number(String(shiftText).replace(/[^0-9.-]/g, '')) : null;

  return {
    apparatusNumber: apparatusNumber(unitNumber),
    unitNumber,
    callSign,
    serviceStatus: unitStatus || currentStatus,
    createdDate,
    createdAtMillis: dateMillis(createdDate),
    shiftId: Number.isFinite(shiftId) ? shiftId : null
  };
}

function newestPerVehicle(records) {
  const result = new Map();
  for (const record of records) {
    const current = result.get(record.apparatusNumber);
    if (!current || isNewer(record, current)) result.set(record.apparatusNumber, record);
  }
  return result;
}

function isNewer(candidate, current) {
  if (candidate.createdAtMillis !== current.createdAtMillis) {
    return candidate.createdAtMillis > current.createdAtMillis;
  }
  if (Number.isFinite(candidate.shiftId) && Number.isFinite(current.shiftId)) {
    return candidate.shiftId > current.shiftId;
  }
  return false;
}

function statusClass(value) {
  const status = normalize(value);
  if (['IN-SERVICE', 'IN SERVICE', 'RESERVE'].includes(status)) return 'active';
  if (['UNAVAILABLE', 'OUT OF SERVICE', 'MAINTENANCE'].includes(status)) return 'inactive';
  return 'unknown';
}

function validatedApiPath(value) {
  const path = String(value || '').trim();
  if (!path) throw new Error('Provide an OperativeIQ resource path with ?path=/api/... or OPERATIVE_ASSIGNMENTS_PATH.');
  if (!path.startsWith('/api/')) throw new Error('The OperativeIQ resource path must begin with /api/.');
  if (path.includes('://') || path.includes('\\')) throw new Error('The OperativeIQ resource path is invalid.');
  return path;
}

function stringField(source, names) {
  for (const name of names) {
    if (source?.[name] !== undefined && source[name] !== null) return String(source[name]).trim();
  }
  return '';
}

function apparatusNumber(value) {
  const match = String(value || '').toUpperCase().match(/\bF\d{2,4}\b/);
  return match ? match[0] : '';
}

function normalizeCallSign(value) {
  return String(value || '').trim().replace(/\s+/g, ' ')
    .replace(/^Medic\s+1-44$/i, 'Medic 144')
    .replace(/^Medic\s+2-44$/i, 'Medic 244');
}

function assignmentKey(value) {
  return String(normalizeCallSign(value)).toLowerCase().replace(/[^a-z0-9]/g, '');
}

function normalize(value) {
  return String(value || '').trim().toUpperCase().replace(/\s+/g, ' ');
}

function normalizeBoolean(value) {
  if (value === true) return true;
  if (value === false || value === null || value === undefined) return false;
  return ['TRUE', '1', 'YES', 'Y', 'ON'].includes(normalize(value));
}

function dateMillis(value) {
  const millis = new Date(String(value || '').replace(/^[A-Za-z]+,\s*/, '')).getTime();
  return Number.isFinite(millis) ? millis : 0;
}

function safeApiError(text) {
  try {
    const payload = JSON.parse(text);
    return payload.error_description || payload.error || payload.message || 'API request failed.';
  } catch (_error) {
    return String(text || '').slice(0, 300);
  }
}

function json(value, status = 200) {
  return Response.json(value, {
    status,
    headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0' }
  });
}

function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}
