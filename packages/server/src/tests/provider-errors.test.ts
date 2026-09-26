import { afterEach, describe, expect, it, vi } from 'vitest';
import { createTestDatabase } from '../test-utils/test-db.js';
import { createApp } from '../app.js';
import { ProviderRegistry } from '../providers/registry.js';

describe('Provider error statuses', () => {
  afterEach(() => { vi.unstubAllGlobals(); });

  it('reports a rejected provider API key as 422 so the client does not treat it as a signed-out session', async () => {
    const app = createApp(await createTestDatabase(), new ProviderRegistry(), { mode: 'optional' });
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{"error":"bad key"}', { status: 401 })));

    const res = await app.fetch(new Request('http://localhost/api/providers/models', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ providerId: 'openai', credential: { apiKey: 'wrong-key' } }),
    }));

    expect(res.status).toBe(422);
    const body: any = await res.json();
    expect(body.error.code).toBe('invalid_credential');
  });
});
