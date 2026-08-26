import baseWorker from './operative-preview.js';

const PHYSICAL_DUE_PATH = '/preview-physical-due';
const PHYSICAL_DUE_CACHE_SECONDS = 4 * 60 * 60;

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // Keep authentication in front of the shared cache.
    if (url.pathname === PHYSICAL_DUE_PATH && !url.searchParams.has('at')) {
      if (!authorized(request, env)) {
        return baseWorker.fetch(request, env, ctx);
      }
      return sharedPhysicalDueSnapshot(request, env, ctx);
    }

    // Historical ?at= tests are intentionally uncached.
    return baseWorker.fetch(request, env, ctx);
  },

  async scheduled(controller, env, ctx) {
    if (typeof baseWorker.scheduled === 'function') {
      return baseWorker.scheduled(controller, env, ctx);
    }
  }
};

function authorized(request, env) {
  return Boolean(env.SYNC_ADMIN_TOKEN) &&
    request.headers.get('Authorization') === `Bearer ${env.SYNC_ADMIN_TOKEN}`;
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

async function sharedPhysicalDueSnapshot(request, env, ctx) {
  const cache = globalThis.caches?.default;
  if (!cache) return baseWorker.fetch(request, env, ctx);

  const cacheUrl = new URL(request.url);
  cacheUrl.pathname = PHYSICAL_DUE_PATH;
  cacheUrl.search = '';
  cacheUrl.hash = '';
  const cacheKey = new Request(cacheUrl);

  const cached = await cache.match(cacheKey);
  if (cached) return cacheResponse(cached, 'HIT');

  const response = await baseWorker.fetch(request, env, ctx);
  if (!response.ok) return response;

  const shared = cacheResponse(response, 'MISS');
  const write = cache.put(cacheKey, shared.clone());
  if (ctx?.waitUntil) ctx.waitUntil(write);
  else await write;
  return shared;
}
