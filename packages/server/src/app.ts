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

export function createApp(db: D1Database, registry?: ProviderRegistry, options?: { allowedOrigin?: string }) {
  const app = new Hono();
  const providerRegistry = registry ?? new ProviderRegistry();

  app.use(
    '*',
    cors({
      origin: options?.allowedOrigin || '*',
      allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowHeaders: ['Content-Type', 'Authorization', 'X-Espera-Credential'],
    })
  );

  app.get('/api/health', (c) => {
    return c.json({
      status: 'ok',
      name: 'Project Espera API Engine',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
    });
  });

  app.route('/api/chat', createChatRoutes(db, providerRegistry));
  app.route('/api/conversations', createConversationRoutes(db));
  app.route('/api/memories', createMemoryRoutes(db));
  app.route('/api/persona', createPersonaRoutes(db));
  app.route('/api/providers', createProviderRoutes(db, providerRegistry));
  app.route('/api/inspector', createInspectorRoutes(db));

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
