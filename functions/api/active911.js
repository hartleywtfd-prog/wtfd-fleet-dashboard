const ACTIVE911_API_ROOT =
  'https://access.active911.com/interface/open_api/api';
const ACTIVE911_TOKEN_URL =
  'https://console.active911.com/interface/dev/api_access.php';

let cachedAccessToken = '';
let cachedAccessTokenExpiresAt = 0;

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store'
    }
  });
}

function unwrapActive911(payload) {
  if (
    payload &&
    payload.result === 'success' &&
    payload.message
  ) {
    return payload.message;
  }

  if (payload && payload.result === 'error') {
    throw new Error(
      typeof payload.message === 'string'
        ? payload.message
        : 'Active911 returned an error.'
    );
  }

  return payload || {};
}

async function getAccessToken(env) {
  const now = Date.now();

  if (
    cachedAccessToken &&
    cachedAccessTokenExpiresAt > now + 60_000
  ) {
    return cachedAccessToken;
  }

  const refreshToken = String(
    env.ACTIVE911_REFRESH_TOKEN || ''
  ).trim();

  if (!refreshToken) {
    throw new Error(
      'ACTIVE911_REFRESH_TOKEN is not configured in Cloudflare.'
    );
  }

  const body = new URLSearchParams({
    refresh_token: refreshToken
  });

  const response = await fetch(ACTIVE911_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type':
        'application/x-www-form-urlencoded;charset=UTF-8',
      Accept: 'application/json'
    },
    body: body.toString()
  });

  const text = await response.text();
  let payload;

  try {
    payload = JSON.parse(text);
  } catch {
    throw new Error(
      `Active911 token response was not valid JSON (${response.status}).`
    );
  }

  if (!response.ok || !payload.access_token) {
    throw new Error(
      payload.error_description ||
      payload.error ||
      payload.message ||
      'Unable to obtain an Active911 access token.'
    );
  }

  cachedAccessToken = String(payload.access_token).trim();

  const expirationSeconds = Number(payload.expiration);
  const expiresInSeconds = Number(payload.expires_in);

  if (Number.isFinite(expirationSeconds)) {
    cachedAccessTokenExpiresAt =
      expirationSeconds > 10_000_000_000
        ? expirationSeconds
        : expirationSeconds * 1000;
  } else if (Number.isFinite(expiresInSeconds)) {
    cachedAccessTokenExpiresAt =
      now + expiresInSeconds * 1000;
  } else {
    cachedAccessTokenExpiresAt =
      now + 23 * 60 * 60 * 1000;
  }

  return cachedAccessToken;
}

async function active911Fetch(path, accessToken) {
  const response = await fetch(
    `${ACTIVE911_API_ROOT}${path}`,
    {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json'
      }
    }
  );

  const text = await response.text();
  let payload;

  try {
    payload = JSON.parse(text);
  } catch {
    throw new Error(
      `Active911 returned invalid JSON (${response.status}).`
    );
  }

  if (!response.ok) {
    throw new Error(
      payload.error_description ||
      payload.error ||
      payload.message ||
      `Active911 request failed (${response.status}).`
    );
  }

  return unwrapActive911(payload);
}

function timestampValue(alert) {
  const value = alert.received || alert.sent || '';
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeAlert(alert) {
  return {
    id: String(alert.id || ''),
    description:
      alert.description || alert.cad_code || 'Emergency Call',
    place: alert.place || '',
    address: alert.address || '',
    unit: alert.unit || '',
    city: alert.city || '',
    state: alert.state || '',
    crossStreet:
      alert.cross_street ||
      alert.crossStreet ||
      '',
    units: alert.units || '',
    details: alert.details || '',
    priority: alert.priority || '',
    received: alert.received || alert.sent || '',
    latitude:
      alert.latitude === undefined ? null : alert.latitude,
    longitude:
      alert.longitude === undefined ? null : alert.longitude
  };
}

function extractAlertReferences(alertList) {
  if (Array.isArray(alertList)) {
    return alertList;
  }

  if (Array.isArray(alertList.alerts)) {
    return alertList.alerts;
  }

  if (
    alertList.message &&
    Array.isArray(alertList.message.alerts)
  ) {
    return alertList.message.alerts;
  }

  return [];
}

export async function onRequestGet(context) {
  try {
    const accessToken = await getAccessToken(context.env);

    const alertList = await active911Fetch(
      '/alerts?alert_minutes=180',
      accessToken
    );

    const references = extractAlertReferences(alertList);

    if (!references.length) {
      return jsonResponse({ alert: null });
    }

    const candidateMap = new Map();

    [...references.slice(0, 10), ...references.slice(-10)]
      .forEach(reference => {
        if (reference && reference.id) {
          candidateMap.set(String(reference.id), reference);
        }
      });

    const recentReferences = [...candidateMap.values()];

    const alerts = await Promise.all(
      recentReferences.map(async reference => {
        const id = reference && reference.id;
        if (!id) return null;

        try {
          const result = await active911Fetch(
            `/alerts/${encodeURIComponent(id)}`,
            accessToken
          );

          return result.alert || result || null;
        } catch (error) {
          console.error(
            `Unable to retrieve Active911 alert ${id}:`,
            error
          );
          return null;
        }
      })
    );

    const latest = alerts
      .filter(alert => alert && alert.id)
      .sort((a, b) => timestampValue(b) - timestampValue(a))[0];

    return jsonResponse({
      alert: latest ? normalizeAlert(latest) : null
    });
  } catch (error) {
    console.error('Active911 endpoint error:', error);

    return jsonResponse(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Unknown Active911 error.'
      },
      502
    );
  }
}
