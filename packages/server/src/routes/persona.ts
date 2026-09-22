import { Hono } from 'hono';
import { UpdatePersonaSchema } from '@espera/shared';
import type { D1Database } from '../db/d1-interface.js';
import { PersonaRepository } from '../db/repositories/persona.repo.js';
import { UserRepository } from '../db/repositories/user.repo.js';
import { requestUserId } from '../auth/service.js';

export function createPersonaRoutes(db: D1Database) {
  const router = new Hono();
  const personaRepo = new PersonaRepository(db);
  const userRepo = new UserRepository(db);

  // GET /api/persona
  router.get('/', async (c) => {
    const userId = requestUserId(c);
    await userRepo.ensureUser(userId, 'Espera User');
    const persona = await personaRepo.ensureDefaultPersona(userId);
    return c.json({ persona });
  });

  // GET /api/persona/revisions
  router.get('/revisions', async (c) => {
    const userId = requestUserId(c);
    await userRepo.ensureUser(userId, 'Espera User');
    const persona = await personaRepo.ensureDefaultPersona(userId);
    const revisions = await personaRepo.getRevisions(persona.id);
    return c.json({ revisions });
  });

  router.post('/revisions/:version/restore', async (c) => {
    const userId = requestUserId(c);
    const version = Number(c.req.param('version'));
    if (!Number.isInteger(version) || version < 1) return c.json({ error: 'A valid revision version is required' }, 400);
    try {
      const persona = await personaRepo.restoreRevision(userId, version);
      return c.json({ persona });
    } catch (error) {
      return c.json({ error: error instanceof Error ? error.message : 'Persona revision could not be restored' }, 404);
    }
  });

  // PUT /api/persona
  router.put('/', async (c) => {
    const userId = requestUserId(c);
    await userRepo.ensureUser(userId, 'Espera User');
    const raw = await c.req.json();
    const parsed = UpdatePersonaSchema.safeParse(raw);
    if (!parsed.success) {
      return c.json({ error: 'Validation failed', details: parsed.error.flatten() }, 400);
    }

    const updated = await personaRepo.updatePersona(userId, parsed.data);
    return c.json({ persona: updated });
  });

  return router;
}
