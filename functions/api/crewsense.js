const TOKEN_URL = 'https://api.crewsense.com/oauth/access_token';
const SCHEDULE_URL = 'https://api.crewsense.com/v1/schedule';
const ORGANIZATION_TIME_ZONE = 'America/New_York';

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=UTF-8',
      'Cache-Control': 'private, max-age=30, stale-while-revalidate=30'
    }
  });
}

function localDateParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: ORGANIZATION_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(date);
  const value = type => parts.find(part => part.type === type)?.value || '';
  return {
    year: Number(value('year')),
    month: Number(value('month')),
    day: Number(value('day'))
  };
}

function localDateString(date = new Date()) {
  const { year, month, day } = localDateParts(date);
  return [
    String(year).padStart(4, '0'),
    String(month).padStart(2, '0'),
    String(day).padStart(2, '0')
  ].join('-');
}

function offsetLocalDate(days) {
  const { year, month, day } = localDateParts();
  const shifted = new Date(Date.UTC(year, month - 1, day + days, 12));
  return localDateString(shifted);
}

function localDateTimeString(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: ORGANIZATION_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23'
  }).formatToParts(date);
  const value = type => parts.find(part => part.type === type)?.value || '';
  return `${value('year')}-${value('month')}-${value('day')} ${value('hour')}:${value('minute')}:${value('second')}`;
}

function normalizeDateTime(value) {
  return String(value || '')
    .trim()
    .replace('T', ' ')
    .replace(/(?:Z|[+-]\d{2}:?\d{2})$/, '')
    .slice(0, 19);
}

function shiftIsCurrent(shift, nowLocal) {
  const start = normalizeDateTime(shift?.start);
  const end = normalizeDateTime(shift?.end);
  if (!start || !end) return true;
  return start <= nowLocal && nowLocal < end;
}

function scheduleDays(payload) {
  if (Array.isArray(payload?.days)) return payload.days;
  if (Array.isArray(payload?.data?.days)) return payload.data.days;
  return [];
}

function normalizeAssignments(payload) {
  const nowLocal = localDateTimeString();
  const assignments = [];

  scheduleDays(payload).forEach(day => {
    (day?.assignments || []).forEach(assignment => {
      const crew = (assignment?.shifts || [])
        .filter(shift => shiftIsCurrent(shift, nowLocal))
        .map(shift => ({
          id: String(shift?.user?.id || ''),
          name:
            shift?.user?.name ||
            shift?.user?.full_name ||
            [shift?.user?.first_name, shift?.user?.last_name]
              .filter(Boolean)
              .join(' '),
          positions: (shift?.labels || [])
            .map(label => label?.label || label?.name || '')
            .filter(Boolean)
        }))
        .filter(member => member.name);

      if (!assignment?.name || !crew.length) return;
      assignments.push({
        id: String(assignment.id || ''),
        name: String(assignment.name),
        start: assignment.start || '',
        end: assignment.end || '',
        crew
      });
    });
  });

  return assignments;
}

async function requestAccessToken(clientId, clientSecret) {
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: 'client_credentials'
  });
  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'application/json'
    },
    body
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload.access_token) {
    throw new Error(
      payload.error_message ||
      payload.error_description ||
      `CrewSense authentication failed (${response.status}).`
    );
  }
  return payload.access_token;
}

async function requestSchedule(accessToken) {
  const url = new URL(SCHEDULE_URL);
  url.searchParams.set('start', `${offsetLocalDate(-1)} 00:00:00`);
  url.searchParams.set('end', `${offsetLocalDate(1)} 23:59:59`);
  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Accept': 'application/json'
    }
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(
      payload.error_message ||
      payload.message ||
      `CrewSense schedule request failed (${response.status}).`
    );
  }
  return payload;
}

export async function onRequestGet(context) {
  const clientId = context.env.CREWSENSE_CLIENT_ID;
  const clientSecret = context.env.CREWSENSE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return jsonResponse({
      error: 'CrewSense API credentials are not configured.'
    }, 503);
  }

  try {
    const accessToken = await requestAccessToken(clientId, clientSecret);
    const schedule = await requestSchedule(accessToken);
    return jsonResponse({
      updatedAt: new Date().toISOString(),
      assignments: normalizeAssignments(schedule)
    });
  } catch (error) {
    return jsonResponse({
      error: 'Unable to retrieve CrewSense assignments.',
      detail: error instanceof Error ? error.message : String(error)
    }, 502);
  }
}
