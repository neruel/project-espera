import { describe, expect, it } from 'vitest';
import { createTestDatabase } from '../test-utils/test-db.js';
import { createApp } from '../app.js';

describe('Provider connection metadata persistence', () => {
  it('persists metadata and model catalog without accepting credentials', async () => {
    const app = createApp(await createTestDatabase());
    const create = await app.fetch(new Request('http://localhost/api/providers/connections', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name: 'Test Gateway',
        providerId: 'openai-compatible',
        baseUrl: 'https://gateway.example/v1',
        apiKey: 'must-never-be-persisted',
        models: [{ id: 'model-a', name: 'Model A', contextWindow: 4096, supportsStreaming: true }],
      }),
    }));
    expect(create.status).toBe(201);
    const created: any = await create.json();
    expect(created.connection.name).toBe('Test Gateway');
    expect(created.connection.models[0].id).toBe('model-a');
    expect(JSON.stringify(created)).not.toContain('must-never-be-persisted');

    const list = await app.fetch(new Request('http://localhost/api/providers/connections'));
    const listed: any = await list.json();
    expect(list.status).toBe(200);
    expect(listed.connections).toHaveLength(1);
    expect(listed.connections[0].baseUrl).toBe('https://gateway.example/v1');

    const remove = await app.fetch(new Request(`http://localhost/api/providers/connections/${created.connection.id}`, { method: 'DELETE' }));
    expect(remove.status).toBe(204);
    const afterDelete = await app.fetch(new Request('http://localhost/api/providers/connections'));
    expect((await afterDelete.json() as any).connections).toHaveLength(0);
  });
});
