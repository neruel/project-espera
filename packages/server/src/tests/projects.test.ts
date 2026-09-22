import { describe, expect, it } from 'vitest';
import { createTestDatabase } from '../test-utils/test-db.js';
import { createApp } from '../app.js';

describe('Project scope persistence', () => {
  it('creates, lists, and deletes projects', async () => {
    const app = createApp(await createTestDatabase());
    const createdResponse = await app.fetch(new Request('http://localhost/api/projects', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Espera roadmap', description: 'Long-term product context' }),
    }));
    expect(createdResponse.status).toBe(201);
    const created: any = await createdResponse.json();
    expect(created.project.status).toBe('active');

    const listResponse = await app.fetch(new Request('http://localhost/api/projects'));
    expect((await listResponse.json() as any).projects).toHaveLength(1);

    await app.fetch(new Request('http://localhost/api/conversations', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ title: 'Scoped conversation', projectId: created.project.id }) }));
    const contentsResponse = await app.fetch(new Request(`http://localhost/api/projects/${created.project.id}/contents`));
    const contents = await contentsResponse.json() as any;
    expect(contentsResponse.status).toBe(200);
    expect(contents.conversations).toHaveLength(1);
    expect(contents.conversations[0].title).toBe('Scoped conversation');

    const deleteResponse = await app.fetch(new Request(`http://localhost/api/projects/${created.project.id}`, { method: 'DELETE' }));
    expect(deleteResponse.status).toBe(204);
  });
});
