const CACHE_SECONDS = 60;

function jsonResponse(body, status = 200, cacheControl = 'no-store') {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=UTF-8',
      'Cache-Control': cacheControl,
      'X-Content-Type-Options': 'nosniff'
    }
  });
}

export async function onRequestGet({ request, env }) {
  if (!env.READINESS_WEB_APP_URL || !env.READINESS_API_TOKEN) {
    return jsonResponse({
      error: 'Operational Readiness is not configured.'
    }, 503);
  }

  const incoming = new URL(request.url);
  const upstream = new URL(env.READINESS_WEB_APP_URL);
  upstream.searchParams.set('api', '1');
  upstream.searchParams.set('token', env.READINESS_API_TOKEN);
  upstream.searchParams.set(
    'view',
    incoming.searchParams.get('view') === 'member' ? 'member' : 'officer'
  );

  const crewSenseId = incoming.searchParams.get('crewSenseId');
  const name = incoming.searchParams.get('name');
  if (crewSenseId) upstream.searchParams.set('crewSenseId', crewSenseId);
  if (name) upstream.searchParams.set('name', name);

  try {
    const cache = caches.default;
    const cacheKey = new Request(incoming.toString(), { method: 'GET' });
    const cached = await cache.match(cacheKey);
    if (cached) return cached;

    const response = await fetch(upstream.toString(), {
      redirect: 'follow',
      headers: { Accept: 'application/json' }
    });
    const text = await response.text();
    let body;
    try {
      body = JSON.parse(text);
    } catch {
      return jsonResponse({
        error: 'The Operational Readiness data source returned an invalid response.'
      }, 502);
    }

    if (!response.ok || body.error) {
      return jsonResponse({
        error: body.error || `Readiness source error (${response.status}).`
      }, response.ok ? 502 : response.status);
    }

    const outgoing = jsonResponse(
      body,
      200,
      `public, max-age=${CACHE_SECONDS}, stale-while-revalidate=${CACHE_SECONDS}`
    );
    await cache.put(cacheKey, outgoing.clone());
    return outgoing;
  } catch (error) {
    return jsonResponse({
      error: 'Unable to reach the Operational Readiness data source.'
    }, 502);
  }
}
