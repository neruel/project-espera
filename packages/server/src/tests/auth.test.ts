import { describe, expect, it, vi } from 'vitest';
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

  it('defaults to required auth when no mode is configured', async () => {
    const app = createApp(await createTestDatabase());
    expect((await app.fetch(new Request('http://localhost/api/conversations'))).status).toBe(401);
  });

  it('purges expired OAuth states and sessions when a login starts', async () => {
    const db = await createTestDatabase();
    const app = createApp(db, undefined, { mode: 'required', githubClientId: 'id', githubClientSecret: 'secret' });
    await db.prepare(`INSERT INTO users (id, name) VALUES ('user_expired', 'Expired')`).run();
    await db.prepare(`INSERT INTO oauth_states (state, provider, redirect_uri, expires_at) VALUES ('old_state', 'github', 'x', datetime('now', '-1 minute'))`).run();
    await db.prepare(`INSERT INTO sessions (id, user_id, token_hash, expires_at) VALUES ('old_session', 'user_expired', 'h1', datetime('now', '-1 minute')), ('live_session', 'user_expired', 'h2', datetime('now', '+1 day'))`).run();
    expect((await app.fetch(new Request('http://localhost/api/auth/github'))).status).toBe(302);
    expect(await db.prepare(`SELECT state FROM oauth_states WHERE state = 'old_state'`).first()).toBeNull();
    expect(await db.prepare(`SELECT id FROM sessions WHERE id = 'old_session'`).first()).toBeNull();
    expect(await db.prepare(`SELECT id FROM sessions WHERE id = 'live_session'`).first()).not.toBeNull();
  });

  it('rejects cross-origin state-changing requests', async () => {
    const app = createApp(await createTestDatabase(), undefined, {
      mode: 'required',
      allowedOrigin: 'https://espera.example',
    });
    const response = await app.fetch(new Request('https://api.example/api/auth/logout', {
      method: 'POST',
      headers: { Origin: 'https://attacker.example' },
    }));

    expect(response.status).toBe(403);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(await response.json()).toEqual({ error: 'origin_not_allowed' });
  });

  it('exchanges a single-use GitHub handoff for a first-party session', async () => {
    const db = await createTestDatabase();
    const app = createApp(db, undefined, {
      mode: 'required',
      allowedOrigin: 'https://espera.example',
      githubClientId: 'test-client-id',
      githubClientSecret: 'test-client-secret',
      githubRedirectUri: 'https://api.example/api/auth/github/callback',
      frontendOrigin: 'https://espera.example',
    });
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = input instanceof Request ? input.url : String(input);
      if (url === 'https://github.com/login/oauth/access_token') {
        return Response.json({ access_token: 'test-github-access-token' });
      }
      if (url === 'https://api.github.com/user') {
        return Response.json({ id: 12345, login: 'espera-test', name: 'Espera Test', email: 'test@example.com' });
      }
      throw new Error(`Unexpected fetch URL: ${url}`);
    });

    try {
      const login = await app.fetch(new Request('https://api.example/api/auth/github'));
      const authorizeUrl = new URL(login.headers.get('location')!);
      const state = authorizeUrl.searchParams.get('state')!;
      const stateCookie = login.headers.get('set-cookie')!.split(';', 1)[0];
      expect(login.status).toBe(302);
      expect(stateCookie).toMatch(/^espera_oauth_state=/);

      const callback = await app.fetch(new Request(
        `https://api.example/api/auth/github/callback?code=test-code&state=${encodeURIComponent(state)}`,
        { headers: { Cookie: stateCookie } },
      ));
      const handoffUrl = new URL(callback.headers.get('location')!);
      const handoff = new URLSearchParams(handoffUrl.hash.slice(1)).get('espera_handoff')!;
      expect(callback.status).toBe(302);
      expect(handoffUrl.origin).toBe('https://espera.example');
      expect(callback.headers.get('set-cookie')).toContain('Max-Age=0');
      expect(callback.headers.get('set-cookie')).not.toContain('espera_session=');
      expect(handoff).toMatch(/^[A-Za-z0-9_-]{43}$/);

      const exchange = await app.fetch(new Request('https://api.example/api/auth/exchange', {
        method: 'POST',
        headers: { Origin: 'https://espera.example', 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticket: handoff }),
      }));
      const sessionCookie = exchange.headers.get('set-cookie')!;
      expect(exchange.status).toBe(200);
      expect(sessionCookie).toContain('HttpOnly');
      expect(sessionCookie).toContain('Secure');
      expect(sessionCookie).toContain('SameSite=Lax');

      const me = await app.fetch(new Request('https://api.example/api/auth/me', {
        headers: { Cookie: sessionCookie.split(';', 1)[0] },
      }));
      expect(await me.json()).toMatchObject({
        authenticated: true,
        user: { id: 'user_github_12345', name: 'Espera Test', email: 'test@example.com' },
      });

      const project = await app.fetch(new Request('https://api.example/api/projects', {
        method: 'POST',
        headers: { Origin: 'https://espera.example', Cookie: sessionCookie.split(';', 1)[0], 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Delete with account', description: 'cascade check' }),
      }));
      expect(project.status).toBe(201);

      const deletion = await app.fetch(new Request('https://api.example/api/auth/account', {
        method: 'DELETE',
        headers: { Origin: 'https://espera.example', Cookie: sessionCookie.split(';', 1)[0] },
      }));
      expect(deletion.status).toBe(200);
      expect(deletion.headers.get('set-cookie')).toContain('Max-Age=0');
      const deletedAccount = await app.fetch(new Request('https://api.example/api/auth/me', {
        headers: { Cookie: sessionCookie.split(';', 1)[0] },
      }));
      expect(((await deletedAccount.json()) as { authenticated: boolean }).authenticated).toBe(false);
      expect(await db.prepare('SELECT id FROM users WHERE id = ?').bind('user_github_12345').first()).toBeNull();
      expect(await db.prepare('SELECT id FROM projects WHERE user_id = ?').bind('user_github_12345').first()).toBeNull();

      const replay = await app.fetch(new Request('https://api.example/api/auth/exchange', {
        method: 'POST',
        headers: { Origin: 'https://espera.example', 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticket: handoff }),
      }));
      expect(replay.status).toBe(401);
    } finally {
      fetchMock.mockRestore();
    }
  });
});
