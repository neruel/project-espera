import { Hono } from 'hono';
import {
  ApproveMemorySchema,
  CreateMemoryManualSchema,
  DeleteMemorySchema,
  EditAndApproveMemorySchema,
  RejectMemorySchema,
} from '@espera/shared';
import type { D1Database } from '../db/d1-interface.js';
import { MemoryRepository } from '../db/repositories/memory.repo.js';

export function createMemoryRoutes(db: D1Database) {
  const router = new Hono();
  const memoryRepo = new MemoryRepository(db);
  const userId = 'user_default';

  // GET /api/memories (list with filters)
  router.get('/', async (c) => {
    const status = c.req.query('status') as any;
    const type = c.req.query('type') as any;
    const projectId = c.req.query('projectId') ?? null;

    const memories = await memoryRepo.getMemories(userId, {
      status,
      type,
      projectId,
    });

    return c.json({ memories });
  });

  // POST /api/memories (create manual memory directly as active)
  router.post('/', async (c) => {
    const raw = await c.req.json();
    const parsed = CreateMemoryManualSchema.safeParse(raw);
    if (!parsed.success) {
      return c.json({ error: 'Validation failed', details: parsed.error.flatten() }, 400);
    }

    const created = await memoryRepo.createCandidate({
      userId,
      type: parsed.data.type,
      subject: parsed.data.subject,
      predicate: parsed.data.predicate,
      valueJson: parsed.data.canonicalText,
      canonicalText: parsed.data.canonicalText,
      importance: parsed.data.importance,
      sensitivity: parsed.data.sensitivity,
      sourceKind: parsed.data.sourceKind,
    });

    // Manually created memories are immediately activated
    const activated = await memoryRepo.approveMemory(created.id, 'Manually created by user', 'user');
    return c.json({ memory: activated }, 201);
  });

  // GET /api/memories/:id (details with revisions and evidence)
  router.get('/:id', async (c) => {
    const id = c.req.param('id');
    const memory = await memoryRepo.getMemoryById(id);
    if (!memory) {
      return c.json({ error: 'Memory not found' }, 404);
    }

    const revisions = await memoryRepo.getRevisions(id);
    const evidence = await memoryRepo.getEvidence(id);

    return c.json({ memory, revisions, evidence });
  });

  // POST /api/memories/:id/approve
  router.post('/:id/approve', async (c) => {
    const id = c.req.param('id');
    const raw = await c.req.json().catch(() => ({}));
    const parsed = ApproveMemorySchema.safeParse(raw);
    const reason = parsed.success ? parsed.data.changeReason : 'Approved by user';

    try {
      const updated = await memoryRepo.approveMemory(id, reason, 'user');
      return c.json({ memory: updated });
    } catch (err: any) {
      return c.json({ error: err.message }, 400);
    }
  });

  // POST /api/memories/:id/edit-and-approve
  router.post('/:id/edit-and-approve', async (c) => {
    const id = c.req.param('id');
    const raw = await c.req.json();
    const parsed = EditAndApproveMemorySchema.safeParse(raw);
    if (!parsed.success) {
      return c.json({ error: 'Validation failed', details: parsed.error.flatten() }, 400);
    }

    try {
      const updated = await memoryRepo.editAndApproveMemory(
        id,
        {
          canonicalText: parsed.data.canonicalText,
          importance: parsed.data.importance,
          type: parsed.data.type,
          changeReason: parsed.data.changeReason,
        },
        'user'
      );
      return c.json({ memory: updated });
    } catch (err: any) {
      return c.json({ error: err.message }, 400);
    }
  });

  // POST /api/memories/:id/reject
  router.post('/:id/reject', async (c) => {
    const id = c.req.param('id');
    const raw = await c.req.json().catch(() => ({}));
    const parsed = RejectMemorySchema.safeParse(raw);
    const reason = parsed.success ? parsed.data.reason : 'Rejected by user';

    try {
      const updated = await memoryRepo.rejectMemory(id, reason, 'user');
      return c.json({ memory: updated });
    } catch (err: any) {
      return c.json({ error: err.message }, 400);
    }
  });

  // DELETE /api/memories/:id
  router.delete('/:id', async (c) => {
    const id = c.req.param('id');
    const mode = c.req.query('mode') || 'soft';

    try {
      if (mode === 'hard') {
        await memoryRepo.hardDeleteMemory(id);
        return c.json({ success: true, mode: 'hard' });
      } else {
        const updated = await memoryRepo.softDeleteMemory(id, 'Soft deleted by user', 'user');
        return c.json({ success: true, mode: 'soft', memory: updated });
      }
    } catch (err: any) {
      return c.json({ error: err.message }, 400);
    }
  });

  return router;
}
