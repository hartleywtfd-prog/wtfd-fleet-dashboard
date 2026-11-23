// Worker adapter for the existing Cloudflare Pages Functions.
// Preserve the original API implementations while serving static files via ASSETS.
import { onRequestGet as active911 } from "../functions/api/active911.js";
import { onRequestGet as crewsense } from "../functions/api/crewsense.js";
import { onRequestGet as dashboard_compare } from "../functions/api/dashboard-compare.js";
import { onRequestGet as dashboard_v2 } from "../functions/api/dashboard-v2.js";
import { onRequestGet as dashboard } from "../functions/api/dashboard.js";
import { onRequestGet as readiness } from "../functions/api/readiness.js";
import { onRequestGet as sync } from "../functions/api/sync.js";

const getHandlers = {
  "/api/active911": active911,
  "/api/crewsense": crewsense,
  "/api/dashboard-compare": dashboard_compare,
  "/api/dashboard-v2": dashboard_v2,
  "/api/dashboard": dashboard,
  "/api/readiness": readiness,
  "/api/sync": sync
};

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const apiPath = url.pathname.replace(/\/+$/, "") || "/";
    if (apiPath.startsWith("/api/")) {
      const handler = getHandlers[apiPath];
      if (!handler) {
        return new Response(JSON.stringify({ error: "API route not found." }), {
          status: 404, headers: { "Content-Type": "application/json; charset=UTF-8" }
        });
      }
      if (request.method !== "GET" && request.method !== "HEAD") {
        return new Response("Method Not Allowed", { status: 405, headers: { Allow: "GET, HEAD" } });
      }
      // Existing functions expect Cloudflare Pages context-style properties.
      const response = await handler({ request, env, waitUntil: ctx.waitUntil.bind(ctx),
        passThroughOnException: () => {} });
      return request.method === "HEAD" ? new Response(null, response) : response;
    }
    return env.ASSETS.fetch(request);
  }
};
