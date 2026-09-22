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

  it('preserves an encrypted credential when connection metadata is edited without re-entering the key', async () => {
    const masterKey = Buffer.alloc(32, 7).toString('base64');
    const app = createApp(await createTestDatabase(), undefined, { credentialEncryptionKey: masterKey });
    const createdResponse = await app.fetch(new Request('http://localhost/api/providers/connections', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: 'Saved mock', providerId: 'mock', models: [{ id: 'mock-model-a', name: 'Mock', contextWindow: 100, supportsStreaming: true }], credential: { apiKey: 'saved-secret' }, rememberCredential: true }) }));
    const created = await createdResponse.json() as any;
    expect(created.connection.credentialStored).toBe(true);
    const editedResponse = await app.fetch(new Request('http://localhost/api/providers/connections', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: created.connection.id, name: 'Renamed mock', providerId: 'mock', models: created.connection.models, rememberCredential: true }) }));
    const edited = await editedResponse.json() as any;
    expect(edited.connection.name).toBe('Renamed mock');
    expect(edited.connection.credentialStored).toBe(true);
    expect(JSON.stringify(edited)).not.toContain('saved-secret');
    const validation = await app.fetch(new Request(`http://localhost/api/providers/connections/${created.connection.id}/validate`, { method: 'POST' }));
    expect(validation.status).toBe(200);
    expect((await validation.json() as any).isValid).toBe(true);
  });
});
