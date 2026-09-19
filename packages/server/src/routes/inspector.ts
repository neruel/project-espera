import { Hono } from 'hono';
import type { D1Database } from '../db/d1-interface.js';
import { ContextRunRepository } from '../db/repositories/context-run.repo.js';
import { requestUserId } from '../auth/service.js';

export function createInspectorRoutes(db: D1Database) {
  const router = new Hono();
  const runRepo = new ContextRunRepository(db);

  // GET /api/inspector/:conversationId
  router.get('/:conversationId', async (c) => {
    const convId = c.req.param('conversationId');
    const run = await runRepo.getLatestRun(convId, requestUserId(c));

    if (!run) {
      return c.json({ contextRun: null, message: 'No context run recorded yet for this conversation' });
    }

    // Return sanitized context run for developer inspector
    return c.json({ contextRun: run });
  });

  return router;
}
