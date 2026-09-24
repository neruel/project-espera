import { describe, expect, it } from 'vitest';
import { createTestDatabase } from '../test-utils/test-db.js';
import { createApp } from '../app.js';
import { UserRepository } from '../db/repositories/user.repo.js';
import { MemoryRepository } from '../db/repositories/memory.repo.js';

describe('Memory search and pagination', () => {
  it('filters by query and type and paginates without exposing another user', async () => {
    const db = await createTestDatabase();
    await new UserRepository(db).ensureUser('user_default', 'Default');
    await new UserRepository(db).ensureUser('other_user', 'Other');
    const repository = new MemoryRepository(db);
    for (let index = 0; index < 7; index++) await repository.createCandidate({ userId: 'user_default', type: 'goal', subject: 'user', predicate: 'builds', valueJson: `Espera ${index}`, canonicalText: `Build Espera milestone ${index}` });
    await repository.createCandidate({ userId: 'other_user', type: 'goal', subject: 'other', predicate: 'builds', valueJson: 'private', canonicalText: 'Build Espera private milestone' });
    const app = createApp(db, undefined, { mode: 'optional' });
    const firstResponse = await app.fetch(new Request('http://localhost/api/memories?q=Espera&type=goal&limit=5&sort=updated'));
    const first = await firstResponse.json() as any;
    expect(first.memories).toHaveLength(5);
    expect(first.hasMore).toBe(true);
    const secondResponse = await app.fetch(new Request('http://localhost/api/memories?q=Espera&type=goal&limit=5&offset=5'));
    const second = await secondResponse.json() as any;
    expect(second.memories).toHaveLength(2);
    expect(second.hasMore).toBe(false);
    expect([...first.memories, ...second.memories].every((memory) => memory.userId === 'user_default')).toBe(true);
  });
});
