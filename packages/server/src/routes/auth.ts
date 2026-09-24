import { Hono } from 'hono';
import type { D1Database } from '../db/d1-interface.js';
import { AuthService, type AuthConfig } from '../auth/service.js';

export function createAuthRoutes(db: D1Database, config: AuthConfig) {
  const router = new Hono();
  const auth = new AuthService(db, config);
  router.get('/me', (c) => auth.me(c.req.raw));
  router.get('/github', (c) => auth.beginGithub(c.req.raw));
  router.get('/github/callback', (c) => auth.finishGithub(c.req.raw));
  router.post('/exchange', (c) => auth.exchangeGithubHandoff(c.req.raw));
  router.post('/logout', (c) => auth.logout(c.req.raw));
  router.delete('/account', (c) => auth.deleteAccount(c.req.raw));
  return router;
}
