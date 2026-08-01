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

let cachedToken = null;
let cachedTokenExpiresAt = 0;

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

      if (url.pathname === '/inspect-incomplete-checks') {
        return json(await inspectIncompleteChecks(env));
      }

      if (url.pathname === '/probe-incomplete-checks') {
        return json(await probeIncompleteChecks(env));
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
          '/inspect-incomplete-checks',
          '/probe-incomplete-checks',
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

  async scheduled(_controller, env, ctx) {
    if (!normalizeBoolean(env.OPERATIVE_APPLY_ENABLED)) {
      console.log('OperativeIQ scheduled assignment sync skipped: OPERATIVE_APPLY_ENABLED is false.');
      return;
    }

    ctx.waitUntil(runScheduledAssignmentSync(env));
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

async function inspectIncompleteChecks(env) {
  const { specification, swaggerPath } = await loadSwagger(env);
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

async function loadSwagger(env, existingToken = null) {
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
      if (Object.keys(specification.paths || {}).length) {
        return { specification, swaggerPath: path, attempts };
      }
    } catch (_error) {
      // Continue to the next documented Swagger location.
    }
  }
  throw new Error(`No supported Swagger JSON document was found: ${JSON.stringify(attempts)}`);
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
