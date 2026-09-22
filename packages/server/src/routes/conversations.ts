import { Hono } from 'hono';
import { CreateConversationSchema } from '@espera/shared';
import type { D1Database } from '../db/d1-interface.js';
import { ConversationRepository } from '../db/repositories/conversation.repo.js';
import { UserRepository } from '../db/repositories/user.repo.js';
import { requestUserId } from '../auth/service.js';
import { ProjectRepository } from '../db/repositories/project.repo.js';

export function createConversationRoutes(db: D1Database) {
  const router = new Hono();
  const convRepo = new ConversationRepository(db);
  const userRepo = new UserRepository(db);
  const projectRepo = new ProjectRepository(db);

  // GET /api/conversations
  router.get('/', async (c) => {
    const userId = requestUserId(c);
    const list = await convRepo.getConversations(userId);
    return c.json({ conversations: list });
  });

  // POST /api/conversations
  router.post('/', async (c) => {
    const userId = requestUserId(c);
    await userRepo.ensureUser(userId, 'Espera User');
    const raw = await c.req.json().catch(() => ({}));
    const parsed = CreateConversationSchema.safeParse(raw);
    if (!parsed.success) return c.json({ error: 'Invalid conversation', details: parsed.error.flatten() }, 400);
    const title = parsed.data.title;
    const projectId = parsed.data.projectId;
    if (projectId && !(await projectRepo.get(projectId, userId))) return c.json({ error: 'Project not found' }, 404);

    const conv = await convRepo.createConversation(userId, title, projectId);
    return c.json({ conversation: conv }, 201);
  });

  // GET /api/conversations/:id
  router.get('/:id', async (c) => {
    const userId = requestUserId(c);
    const id = c.req.param('id');
    const conv = await convRepo.getConversation(id, userId);
    if (!conv) {
      return c.json({ error: 'Conversation not found' }, 404);
    }
    return c.json({ conversation: conv });
  });

  // GET /api/conversations/:id/messages
  router.get('/:id/messages', async (c) => {
    const userId = requestUserId(c);
    const id = c.req.param('id');
    const conv = await convRepo.getConversation(id, userId);
    if (!conv) return c.json({ error: 'Conversation not found' }, 404);
    const limit = Math.min(Math.max(Number(c.req.query('limit')) || 50, 1), 100);
    const offset = Math.max(Number(c.req.query('offset')) || 0, 0);
    const rows = await convRepo.getRecentMessages(id, limit + 1, offset);
    return c.json({ messages: rows.slice(rows.length > limit ? 1 : 0), hasMore: rows.length > limit });
  });

  // DELETE /api/conversations/:id
  router.delete('/:id', async (c) => {
    const userId = requestUserId(c);
    const deleted = await convRepo.deleteConversation(c.req.param('id'), userId);
    if (!deleted) return c.json({ error: 'Conversation not found' }, 404);
    return c.body(null, 204);
  });

  router.patch('/:id/project', async (c) => {
    const userId = requestUserId(c);
    const body = await c.req.json().catch(() => ({} as { projectId?: unknown }));
    const projectId = body.projectId === null || typeof body.projectId === 'string' ? body.projectId : undefined;
    if (projectId === undefined) return c.json({ error: 'projectId must be a string or null' }, 400);
    if (projectId && !(await projectRepo.get(projectId, userId))) return c.json({ error: 'Project not found' }, 404);
    const conversation = await convRepo.updateProject(c.req.param('id'), userId, projectId);
    if (!conversation) return c.json({ error: 'Conversation not found' }, 404);
    return c.json({ conversation });
  });

  router.patch('/:id/title', async (c) => {
    const userId = requestUserId(c);
    const body = await c.req.json().catch(() => ({} as { title?: unknown }));
    const title = typeof body.title === 'string' ? body.title.trim() : '';
    if (!title || title.length > 200) return c.json({ error: 'A title between 1 and 200 characters is required' }, 400);
    const conversation = await convRepo.updateTitle(c.req.param('id'), userId, title);
    if (!conversation) return c.json({ error: 'Conversation not found' }, 404);
    return c.json({ conversation });
  });

  router.delete('/:id/messages/:messageId', async (c) => {
    const userId = requestUserId(c);
    const conversationId = c.req.param('id');
    if (!(await convRepo.getConversation(conversationId, userId))) return c.json({ error: 'Conversation not found' }, 404);
    const deleted = await convRepo.deleteMessage(c.req.param('messageId'), conversationId);
    return deleted ? c.body(null, 204) : c.json({ error: 'Message not found' }, 404);
  });

  return router;
}
