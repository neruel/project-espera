import { describe, expect, it } from 'vitest';
import { createTestDatabase } from '../test-utils/test-db.js';
import { createApp } from '../app.js';

describe('Provider connection metadata persistence', () => {
  it('persists metadata and model catalog without accepting credentials', async () => {
    const app = createApp(await createTestDatabase(), undefined, { mode: 'optional' });
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

  it('assigns a fresh id instead of colliding with another user connection id', async () => {
    const db = await createTestDatabase();
    const app = createApp(db, undefined, { mode: 'optional' });
    await db.prepare(`INSERT INTO users (id, name) VALUES ('other_user', 'Other')`).run();
    await db.prepare(`INSERT INTO provider_connections (id, user_id, provider_id, display_name, auth_mode, status) VALUES ('conn_foreign', 'other_user', 'mock', 'Foreign', 'session', 'active')`).run();
    const response = await app.fetch(new Request('http://localhost/api/providers/connections', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: 'conn_foreign', name: 'Mine', providerId: 'mock', models: [] }) }));
    expect(response.status).toBe(201);
    const saved = await response.json() as any;
    expect(saved.connection.id).not.toBe('conn_foreign');
    expect(saved.connection.name).toBe('Mine');
    expect(await db.prepare(`SELECT display_name as name FROM provider_connections WHERE id = 'conn_foreign'`).first()).toEqual({ name: 'Foreign' });
  });

  it('preserves an encrypted credential when connection metadata is edited without re-entering the key', async () => {
    const masterKey = Buffer.alloc(32, 7).toString('base64');
    const app = createApp(await createTestDatabase(), undefined, { mode: 'optional', credentialEncryptionKey: masterKey });
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
