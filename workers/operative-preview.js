const AUTH_URL = 'https://auth.operativeiqfrontline.com/FrontlineV_live/token';
const RESOURCE_ROOT = 'https://client.operativeiqfrontline.com/FrontlineV_live';
const PAGE_SIZE = 200;
const IGNORED_APPARATUS = new Set(['F140']);
const SWAGGER_CANDIDATES = [
  '/swagger/docs/v1',
  '/swagger/v1/swagger.json',
  '/swagger/v2/swagger.json',
  '/swagger/swagger.json'
];

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

      if (url.pathname === '/preview') {
        const endpoint = validatedApiPath(
          url.searchParams.get('path') || env.OPERATIVE_ASSIGNMENTS_PATH
        );
        return json(await previewAssignments(env, endpoint));
      }

      return json({
        error: 'Not found',
        routes: ['/inspect', '/preview?path=/api/...']
      }, 404);
    } catch (error) {
      return json({ error: errorMessage(error) }, 500);
    }
  }
};

function authorized(request, env) {
  return Boolean(env.SYNC_ADMIN_TOKEN) &&
    request.headers.get('Authorization') === `Bearer ${env.SYNC_ADMIN_TOKEN}`;
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

async function fetchAll(endpoint, token) {
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
    if (!page.length || page.length < PAGE_SIZE || (overall !== null && records.length >= overall)) break;
    skip += page.length;
    if (skip > 20000) throw new Error('OperativeIQ pagination exceeded the 20,000-record safety limit.');
  }

  return records;
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
