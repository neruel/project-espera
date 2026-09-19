import { Hono } from 'hono';
import type { Project } from '@espera/shared';
import type { D1Database } from '../db/d1-interface.js';
import { ProjectRepository } from '../db/repositories/project.repo.js';
import { UserRepository } from '../db/repositories/user.repo.js';
import { requestUserId } from '../auth/service.js';

export function createProjectRoutes(db: D1Database) {
  const router = new Hono();
  const users = new UserRepository(db);
  const projects = new ProjectRepository(db);

  router.get('/', async (c) => {
    const userId = requestUserId(c);
    await users.ensureUser(userId, 'Espera User');
    return c.json({ projects: await projects.list(userId) });
  });

  router.post('/', async (c) => {
    const userId = requestUserId(c);
    const body: any = await c.req.json().catch(() => ({}));
    const name = String(body.name || '').trim();
    const description = String(body.description || '').trim();
    if (!name || name.length > 100 || description.length > 2000) return c.json({ error: 'A project name and valid description are required' }, 400);
    await users.ensureUser(userId, 'Espera User');
    return c.json({ project: await projects.create(userId, name, description) }, 201);
  });

  router.put('/:id', async (c) => {
    const userId = requestUserId(c);
    const body: any = await c.req.json().catch(() => ({}));
    const name = String(body.name || '').trim();
    const description = String(body.description || '').trim();
    const status = body.status as Project['status'];
    if (!name || !['active', 'archived', 'completed'].includes(status) || description.length > 2000) return c.json({ error: 'Invalid project update' }, 400);
    await users.ensureUser(userId, 'Espera User');
    const project = await projects.update(c.req.param('id'), userId, { name, description, status });
    return project ? c.json({ project }) : c.json({ error: 'Project not found' }, 404);
  });

  router.delete('/:id', async (c) => {
    const userId = requestUserId(c);
    await users.ensureUser(userId, 'Espera User');
    return await projects.remove(c.req.param('id'), userId) ? c.body(null, 204) : c.json({ error: 'Project not found' }, 404);
  });
  return router;
}
