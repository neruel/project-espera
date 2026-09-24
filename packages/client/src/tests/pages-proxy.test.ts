import { afterEach, describe, expect, it, vi } from 'vitest';
import { onRequest } from '../../../../functions/api/[[path]].js';

afterEach(() => vi.unstubAllGlobals());

describe('Cloudflare Pages API proxy', () => {
  it('forwards session cookies and preserves auth redirects and Set-Cookie headers', async () => {
    const fetchMock = vi.fn<typeof fetch>(async (input) => {
      const request = input instanceof Request ? input : new Request(input);
      expect(request.url).toBe('https://api.example/api/auth/exchange?source=pages');
      expect(request.headers.get('cookie')).toBe('espera_oauth_state=opaque');
      expect(request.headers.get('origin')).toBe('https://espera.example');
      expect(request.headers.get('x-forwarded-host')).toBeNull();
      expect(await request.text()).toBe(JSON.stringify({ ticket: 'test-ticket' }));
      return new Response(null, {
        status: 302,
        headers: {
          Location: 'https://espera.example/',
          'Set-Cookie': 'espera_session=opaque; Path=/; HttpOnly; Secure; SameSite=Lax',
          'Content-Length': '0',
          Connection: 'keep-alive',
        },
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    const response = await onRequest({
      request: new Request('https://espera.example/api/auth/exchange?source=pages', {
        method: 'POST',
        headers: {
          Cookie: 'espera_oauth_state=opaque',
          Origin: 'https://espera.example',
          'X-Forwarded-Host': 'attacker.example',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ticket: 'test-ticket' }),
      }),
      env: { ESPERA_API_ORIGIN: 'https://api.example' },
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(response.status).toBe(302);
    expect(response.headers.get('location')).toBe('https://espera.example/');
    expect(response.headers.get('set-cookie')).toContain('SameSite=Lax');
    expect(response.headers.get('content-length')).toBeNull();
    expect(response.headers.get('connection')).toBeNull();
  });

  it('rejects insecure or path-bearing API origins', async () => {
    const fetchMock = vi.fn<typeof fetch>();
    vi.stubGlobal('fetch', fetchMock);
    const request = new Request('https://espera.example/api/auth/me');

    const insecure = await onRequest({ request, env: { ESPERA_API_ORIGIN: 'http://api.example' } });
    const pathBearing = await onRequest({ request, env: { ESPERA_API_ORIGIN: 'https://api.example/proxy' } });

    expect(insecure.status).toBe(500);
    expect(pathBearing.status).toBe(500);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
