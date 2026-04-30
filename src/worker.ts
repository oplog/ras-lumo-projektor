/**
 * Worker fetch handler — sits in front of the static-asset binding.
 *
 * Routes:
 *   GET  /api/library     → return the persisted library JSON (or `EMPTY` shape)
 *   PUT  /api/library     → overwrite the library JSON
 *
 * Anything else falls through to ASSETS, which serves the built SPA.
 *
 * The library is stored as a single object in R2. One blob per
 * deployment is enough for the current single-tenant use case;
 * splitting per-variant is a later refactor when concurrency matters.
 */

interface Env {
  ASSETS: Fetcher;
  LIBRARY: R2Bucket;
}

const LIBRARY_KEY = 'library.json';

const EMPTY_LIBRARY = JSON.stringify({ entries: [], emptyStations: [] });

const corsHeaders: Record<string, string> = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET,PUT,OPTIONS',
  'access-control-allow-headers': 'content-type',
};

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/api/library') {
      return handleLibrary(request, env);
    }

    if (url.pathname.startsWith('/api/')) {
      return new Response('Not found', { status: 404 });
    }

    return env.ASSETS.fetch(request);
  },
};

async function handleLibrary(request: Request, env: Env): Promise<Response> {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (request.method === 'GET') {
    const obj = await env.LIBRARY.get(LIBRARY_KEY);
    if (!obj) {
      return new Response(EMPTY_LIBRARY, {
        status: 200,
        headers: { 'content-type': 'application/json', ...corsHeaders },
      });
    }
    return new Response(obj.body, {
      status: 200,
      headers: { 'content-type': 'application/json', ...corsHeaders },
    });
  }

  if (request.method === 'PUT') {
    const body = await request.text();
    // Validate it's parseable JSON of the expected shape; reject
    // anything else so the bucket stays well-formed.
    try {
      const parsed = JSON.parse(body);
      if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.entries)) {
        return new Response('Invalid shape', { status: 400, headers: corsHeaders });
      }
    } catch {
      return new Response('Invalid JSON', { status: 400, headers: corsHeaders });
    }
    await env.LIBRARY.put(LIBRARY_KEY, body, {
      httpMetadata: { contentType: 'application/json' },
    });
    return new Response('OK', { status: 200, headers: corsHeaders });
  }

  return new Response('Method not allowed', {
    status: 405,
    headers: { allow: 'GET, PUT', ...corsHeaders },
  });
}
