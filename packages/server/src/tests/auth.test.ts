import { describe, expect, it } from 'vitest';
import { createTestDatabase } from '../test-utils/test-db.js';
import { createApp } from '../app.js';

describe('authentication boundary', () => {
  it('requires a session when production auth mode is enabled', async () => {
    const app = createApp(await createTestDatabase(), undefined, { mode: 'required' });
    const health = await app.fetch(new Request('http://localhost/api/health'));
    expect(health.status).toBe(200);
    const me = await app.fetch(new Request('http://localhost/api/auth/me'));
    expect(me.status).toBe(200);
    expect((await me.json() as any).authenticated).toBe(false);
    const protectedResponse = await app.fetch(new Request('http://localhost/api/conversations'));
    expect(protectedResponse.status).toBe(401);
  });
});
