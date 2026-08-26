import baseWorker from './operative-preview.js';

const AUTH_URL = 'https://auth.operativeiqfrontline.com/FrontlineV_live/token';
const RESOURCE_ROOT = 'https://client.operativeiqfrontline.com/FrontlineV_live';
const PAGE_SIZE = 200;
const PHYSICAL_DUE_PATH = '/preview-physical-due';
const PHYSICAL_DUE_CACHE_SECONDS = 4 * 60 * 60;

let cachedToken = null;
let cachedTokenExpiresAt = 0;

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname !== PHYSICAL_DUE_PATH) {
      return baseWorker.fetch(request, env, ctx);
    }

    if (!authorized(request, env)) {
      return json({ error: 'Unauthorized' }, 401);
    }

    try {
      const requestedInstant = validatedInstantParameter(url.searchParams.get('at'));

      // Explicit historical/testing requests are always fresh and never
      // allowed to populate or reuse the live four-hour snapshot.
      if (requestedInstant) {
        return json(await previewPhysicalDue(env, requestedInstant));
      }

      return sharedPhysicalDueSnapshot(request, env, ctx);
    } catch (error) {
      return json({ error: errorMessage(error) }, 500);
    }
  },

  async scheduled(controller, env, ctx) {
    if (typeof baseWorker.scheduled === 'function') {
      return baseWorker.scheduled(controller, env, ctx);
    }
  }
};

async function sharedPhysicalDueSnapshot(request, env, ctx) {
  const cache = globalThis.caches?.default;
  if (!cache) {
    return json(await previewPhysicalDue(env));
  }

  const cacheUrl = new URL(request.url);
  cacheUrl.pathname = PHYSICAL_DUE_PATH;
  cacheUrl.search = '';
  cacheUrl.hash = '';
  const cacheKey = new Request(cacheUrl);

  const cached = await cache.match(cacheKey);
  if (cached) {
    return cacheResponse(cached, 'HIT');
  }

  const response = json(await previewPhysicalDue(env));
  if (!response.ok) return response;

  const shared = cacheResponse(response, 'MISS');
  const write = cache.put(cacheKey, shared.clone());
  if (ctx?.waitUntil) ctx.waitUntil(write);
  else await write;
  return shared;
}

function cacheResponse(response, state) {
  const headers = new Headers(response.headers);
  headers.set('Cache-Control', `public, max-age=${PHYSICAL_DUE_CACHE_SECONDS}`);
  headers.set('X-WTFD-Physical-Due-Cache', state);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
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

  const normalizedKey = value =>
    String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');

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

  const text = value =>
    value === null || value === undefined ? '' : String(value).trim();

  const joinKey = value =>
    text(value).toUpperCase().replace(/\s+/g, ' ');

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

  const managementSerial = row =>
    valueByNames(row, [
      'serial___Part_Number',
      'serial_Part_Number',
      'serialPartNumber',
      'serial_Number',
      'serialNumber'
    ]) || valueByPattern(row, /^serialpartnumber$/i);

  const assetSerial = row =>
    valueByNames(row, ['serial_Number', 'serialNumber']);

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
        valueByNames(asset, ['asset_Class', 'assetClass']) ||
        valueByNames(management, ['asset_Class', 'assetClass'])
      );

      const partStatus =
        valueByNames(management, ['part_Status_Active', 'partStatusActive']) ??
        valueByNames(asset, ['part_Status_Active', 'partStatusActive']);

      const catalogValue =
        valueByNames(management, ['catalog_Part', 'catalogPart', 'isCatalogPart']) ??
        valueByNames(asset, ['catalog_Part', 'catalogPart', 'isCatalogPart']);

      const staffMember =
        text(valueByNames(management, ['part_Description', 'partDescription'])) ||
        text(valueByNames(asset, [
          'part_Description',
          'partDescription',
          'asset_Description',
          'assetDescription'
        ]));

      const dueValue =
        valueByNames(management, [
          'next_Preventative_Maintenace_Date',
          'nextPreventativeMaintenanceDate'
        ]) ?? valueByPattern(management, /^nextpreventativemainten.*date$/i);

      const lastValue =
        valueByNames(management, [
          'preventative_Maintenace_Date',
          'preventativeMaintenanceDate'
        ]) ?? valueByPattern(management, /^preventativemainten.*date$/i);

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
        assetTag:
          text(valueByNames(asset, ['asset_Tag_Number', 'assetTagNumber'])) ||
          text(valueByNames(management, ['asset_Tag___Part_UPC', 'assetTagPartUpc'])),
        manufacturer:
          text(valueByNames(management, ['manufacturer'])) ||
          text(valueByNames(asset, ['manufacturer'])),
        location:
          text(valueByNames(asset, ['location'])) ||
          text(valueByNames(management, ['location'])),
        assetClass,
        partStatusActive: true,
        catalogPart: false
      };

      const current = selected.get(serial);
      if (current) diagnostics.duplicateStaffRecord++;

      if (
        !current ||
        row.dueForPhysical > current.dueForPhysical ||
        (
          row.dueForPhysical === current.dueForPhysical &&
          row.lastPhysical > current.lastPhysical
        )
      ) {
        selected.set(serial, row);
      }
    }
  }

  const rows = [...selected.values()].sort((a, b) =>
    a.dueForPhysical.localeCompare(b.dueForPhysical) ||
    a.staffMember.localeCompare(b.staffMember)
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
      joinedSerialNumbers: [...managementBySerial.keys()]
        .filter(key => assetSerialSet.has(key)).length
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
    sheetRows: rows.map(row => [
      row.staffMember,
      displayDate(row.dueForPhysical)
    ]),
    diagnostics,
    note:
      'Read-only dynamic-view join preview matching the Due For Physical Next 30 Days report. No OperativeIQ, D1, Gmail, or Google Sheets data was changed.'
  };
}

async function getAccessToken(env) {
  if (!env.OPERATIVE_CLIENT_ID) {
    throw new Error('OPERATIVE_CLIENT_ID is not configured.');
  }
  if (!env.OPERATIVE_CLIENT_SECRET) {
    throw new Error('OPERATIVE_CLIENT_SECRET is not configured.');
  }

  const now = Date.now();
  if (cachedToken && now < cachedTokenExpiresAt - 60000) {
    return cachedToken;
  }

  const response = await fetch(AUTH_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json'
    },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: env.OPERATIVE_CLIENT_ID,
      client_secret: env.OPERATIVE_CLIENT_SECRET
    })
  });

  const responseText = await response.text();
  if (!response.ok) {
    throw new Error(
      `OperativeIQ authorization failed (${response.status}): ${safeApiError(responseText)}`
    );
  }

  const payload = JSON.parse(responseText);
  if (!payload.access_token) {
    throw new Error(
      'OperativeIQ authorization response did not include access_token.'
    );
  }

  cachedToken = payload.access_token;
  cachedTokenExpiresAt =
    now + Math.max(60, Number(payload.expires_in || 3600)) * 1000;

  return cachedToken;
}

async function fetchAll(endpoint, token, maxRecords = 20000) {
  const records = [];
  let skip = 0;

  while (true) {
    const url = new URL(RESOURCE_ROOT + endpoint);

    if (!url.searchParams.has('$top')) {
      url.searchParams.set('$top', String(PAGE_SIZE));
    }
    url.searchParams.set('$skip', String(skip));

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json'
      }
    });

    const responseText = await response.text();
    if (!response.ok) {
      throw new Error(
        `OperativeIQ resource request failed (${response.status}): ${safeApiError(responseText)}`
      );
    }

    const page = arrayPayload(JSON.parse(responseText));
    records.push(...page);

    if (
      !page.length ||
      page.length < PAGE_SIZE ||
      records.length >= maxRecords
    ) {
      break;
    }

    skip += page.length;
    if (skip > maxRecords) {
      throw new Error(
        `OperativeIQ pagination exceeded the ${maxRecords}-record safety limit.`
      );
    }
  }

  return records.slice(0, maxRecords);
}

function arrayPayload(payload) {
  if (Array.isArray(payload)) return payload;
  for (const key of ['value', 'data', 'results', 'items']) {
    if (Array.isArray(payload?.[key])) return payload[key];
  }
  throw new Error(
    'OperativeIQ resource response did not contain a recognized record array.'
  );
}

function authorized(request, env) {
  return Boolean(env.SYNC_ADMIN_TOKEN) &&
    request.headers.get('Authorization') ===
      `Bearer ${env.SYNC_ADMIN_TOKEN}`;
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

function easternDateKey(date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(date);

  const values = Object.fromEntries(
    parts.map(item => [item.type, item.value])
  );

  return `${values.year}-${values.month}-${values.day}`;
}

function addDaysToDateKey(value, days) {
  const [year, month, day] = String(value).split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return date.toISOString().slice(0, 10);
}

function dateKey(value) {
  const text = String(value || '').trim();

  const iso = text.match(/\d{4}-\d{2}-\d{2}/);
  if (iso) return iso[0];

  const us = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (us) {
    return `${us[3]}-${us[1].padStart(2, '0')}-${us[2].padStart(2, '0')}`;
  }

  const millis =
    new Date(text.replace(/^[A-Za-z]+,\s*/, '')).getTime();

  if (Number.isFinite(millis)) {
    return easternDateKey(new Date(millis));
  }

  return '';
}

function displayDate(value) {
  const match =
    String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);

  return match
    ? `${Number(match[2])}/${Number(match[3])}/${match[1]}`
    : String(value || '');
}

function normalize(value) {
  return String(value || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, ' ');
}

function normalizeBoolean(value) {
  if (value === true) return true;
  if (value === false || value === null || value === undefined) {
    return false;
  }

  return ['TRUE', '1', 'YES', 'Y', 'ON'].includes(normalize(value));
}

function safeApiError(text) {
  try {
    const payload = JSON.parse(text);
    return (
      payload.error_description ||
      payload.error ||
      payload.message ||
      'API request failed.'
    );
  } catch {
    return String(text || '').slice(0, 300);
  }
}

function json(value, status = 200) {
  return Response.json(value, {
    status,
    headers: {
      'Cache-Control':
        'no-store, no-cache, must-revalidate, max-age=0'
    }
  });
}

function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}
