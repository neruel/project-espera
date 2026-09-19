import { Hono } from 'hono';
import { CreateConversationSchema } from '@espera/shared';
import type { D1Database } from '../db/d1-interface.js';
import { ConversationRepository } from '../db/repositories/conversation.repo.js';

export function createConversationRoutes(db: D1Database) {
  const router = new Hono();
  const convRepo = new ConversationRepository(db);
  const userId = 'user_default';

  // GET /api/conversations
  router.get('/', async (c) => {
    const list = await convRepo.getConversations(userId);
    return c.json({ conversations: list });
  });

  // POST /api/conversations
  router.post('/', async (c) => {
    const raw = await c.req.json().catch(() => ({}));
    const parsed = CreateConversationSchema.safeParse(raw);
    const title = parsed.success ? parsed.data.title : 'New Conversation';
    const projectId = parsed.success ? parsed.data.projectId : null;

    const conv = await convRepo.createConversation(userId, title, projectId);
    return c.json({ conversation: conv }, 201);
  });

  // GET /api/conversations/:id
  router.get('/:id', async (c) => {
    const id = c.req.param('id');
    const conv = await convRepo.getConversation(id);
    if (!conv) {
      return c.json({ error: 'Conversation not found' }, 404);
    }
    return c.json({ conversation: conv });
  });

  // GET /api/conversations/:id/messages
  router.get('/:id/messages', async (c) => {
    const id = c.req.param('id');
    const limit = Number(c.req.query('limit')) || 50;
    const messages = await convRepo.getRecentMessages(id, limit);
    return c.json({ messages });
  });

  return router;
}
