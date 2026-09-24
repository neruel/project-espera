const DEFAULT_API_ORIGIN = 'https://project-espera-api.hfainvididual.workers.dev';

interface PagesContext {
  request: Request;
  env?: { ESPERA_API_ORIGIN?: string };
}

const HOP_BY_HOP_HEADERS = [
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
];

export async function onRequest({ request, env }: PagesContext): Promise<Response> {
  let apiOrigin: URL;
  try {
    apiOrigin = new URL(env?.ESPERA_API_ORIGIN || DEFAULT_API_ORIGIN);
  } catch {
    return Response.json({ error: 'api_origin_misconfigured' }, { status: 500 });
  }

  if (
    apiOrigin.protocol !== 'https:' ||
    apiOrigin.username ||
    apiOrigin.password ||
    apiOrigin.pathname !== '/' ||
    apiOrigin.search ||
    apiOrigin.hash
  ) {
    return Response.json({ error: 'api_origin_misconfigured' }, { status: 500 });
  }

  const incoming = new URL(request.url);
  if (!incoming.pathname.startsWith('/api/')) {
    return new Response('Not found', { status: 404 });
  }

  const target = new URL(`${incoming.pathname}${incoming.search}`, apiOrigin);
  const requestHeaders = new Headers(request.headers);
  requestHeaders.delete('host');
  requestHeaders.delete('x-forwarded-host');
  requestHeaders.delete('x-forwarded-proto');

  const sanitizedRequest = new Request(request, { headers: requestHeaders });
  const upstreamRequest = new Request(target, sanitizedRequest);
  const upstream = await fetch(upstreamRequest, { redirect: 'manual' });
  const responseHeaders = new Headers(upstream.headers);
  for (const header of HOP_BY_HOP_HEADERS) responseHeaders.delete(header);
  responseHeaders.delete('content-length');

  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: responseHeaders,
  });
}
