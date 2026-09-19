import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { D1Database } from './db/d1-interface.js';
import { ProviderRegistry } from './providers/registry.js';
import { createChatRoutes } from './routes/chat.js';
import { createConversationRoutes } from './routes/conversations.js';
import { createMemoryRoutes } from './routes/memory.js';
import { createPersonaRoutes } from './routes/persona.js';
import { createProviderRoutes } from './routes/providers.js';
import { createInspectorRoutes } from './routes/inspector.js';
import { createProjectRoutes } from './routes/projects.js';
import { AuthService, type AuthConfig } from './auth/service.js';
import { createAuthRoutes } from './routes/auth.js';

export function createApp(db: D1Database, registry?: ProviderRegistry, options?: { allowedOrigin?: string } & AuthConfig) {
  const app = new Hono();
  const providerRegistry = registry ?? new ProviderRegistry();
  const auth = new AuthService(db, options);

  app.use(
    '*',
    cors({
      origin: options?.allowedOrigin || '*',
      credentials: true,
      allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowHeaders: ['Content-Type', 'Authorization', 'X-Espera-Credential'],
    })
  );

  app.use('/api/*', async (c, next) => {
    const pathname = new URL(c.req.url).pathname;
    if (pathname === '/api/health' || pathname.startsWith('/api/auth/')) return next();
    const user = await auth.currentUser(c.req.raw);
    if (user) {
      (c as any).set('userId', user.id);
      (c as any).set('user', user);
    } else if (auth.mode === 'required') {
      return c.json({ error: 'authentication_required' }, 401);
    } else if (auth.mode !== 'disabled') {
      (c as any).set('userId', 'user_default');
    }
    return next();
  });

  app.get('/api/health', (c) => {
    return c.json({
      status: 'ok',
      name: 'Project Espera API Engine',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
    });
  });

  app.route('/api/auth', createAuthRoutes(db, options || {}));

  app.route('/api/chat', createChatRoutes(db, providerRegistry));
  app.route('/api/conversations', createConversationRoutes(db));
  app.route('/api/memories', createMemoryRoutes(db));
  app.route('/api/persona', createPersonaRoutes(db));
  app.route('/api/providers', createProviderRoutes(db, providerRegistry));
  app.route('/api/inspector', createInspectorRoutes(db));
  app.route('/api/projects', createProjectRoutes(db));

  app.onError((err, c) => {
    console.error('[App Error]', err instanceof Error ? err.name : 'unknown_error');
    return c.json(
      {
        error: 'Internal Server Error',
        message: 'The server could not complete the request.',
      },
      500
    );
  });

  return app;
}
