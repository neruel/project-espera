import { Hono } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import { ValidateProviderCredentialSchema } from '@espera/shared';
import type { D1Database } from '../db/d1-interface.js';
import type { ProviderRegistry } from '../providers/registry.js';
import { maskApiKey } from '../security/crypto.js';
import { ProviderError } from '../providers/http.js';
import { UserRepository } from '../db/repositories/user.repo.js';
import { ProviderConnectionRepository } from '../db/repositories/provider-connection.repo.js';
import { requestUserId } from '../auth/service.js';

// A 401 from this API means the Espera session expired, so the client signs out on it.
// Upstream 401/403 means the provider rejected the user's API key; report that as 422 instead.
function providerErrorStatus(error: ProviderError): ContentfulStatusCode {
  if (error.status === 401 || error.status === 403) return 422;
  return (error.status || 502) as ContentfulStatusCode;
}

export function createProviderRoutes(db: D1Database, registry: ProviderRegistry, credentialEncryptionKey?: string) {
  const router = new Hono();
  const userRepo = new UserRepository(db);
  const connectionRepo = new ProviderConnectionRepository(db);

  router.get('/', async (c) => c.json({
    providers: await Promise.all(registry.list().map(async (provider) => ({
      id: provider.id,
      name: provider.name,
      defaultBaseUrl: provider.defaultBaseUrl,
      models: provider.id === 'mock' ? await provider.listModels() : [],
      capabilities: provider.getCapabilities(),
    }))),
  }));

  router.post('/models', async (c) => {
    try {
      const body: any = await c.req.json();
      if (!body.providerId || (!body.credential?.apiKey && body.providerId !== 'mock')) return c.json({ error: { code: 'invalid_credential', message: 'An API key is required.' } }, 400);
      const models = await registry.get(body.providerId).listModels(body.credential);
      return c.json({ models });
    } catch (error) {
      const providerError = error as ProviderError;
      return c.json({ error: { code: providerError.code || 'provider_unavailable', message: providerError.message || 'Model discovery failed.' } }, providerErrorStatus(providerError));
    }
  });

  router.post('/validate', async (c) => {
    const parsed = ValidateProviderCredentialSchema.safeParse(await c.req.json());
    if (!parsed.success) return c.json({ error: 'Validation failed', details: parsed.error.flatten() }, 400);
    try {
      const { providerId, credential } = parsed.data;
      const isValid = await registry.get(providerId).validateCredential(credential);
      return c.json({ providerId, isValid, maskedKey: maskApiKey(credential.apiKey), testedAt: new Date().toISOString() });
    } catch (error) {
      const providerError = error as ProviderError;
      return c.json({ error: { code: providerError.code || 'unknown_error', message: providerError.message } }, providerErrorStatus(providerError));
    }
  });

  router.get('/connections', async (c) => {
    const userId = requestUserId(c);
    await userRepo.ensureUser(userId, 'Espera User');
    return c.json({ connections: await connectionRepo.list(userId) });
  });

  router.post('/connections', async (c) => {
    const userId = requestUserId(c);
    const body: any = await c.req.json().catch(() => ({}));
    if (!body.name || !body.providerId || !Array.isArray(body.models)) return c.json({ error: 'name, providerId, and models are required' }, 400);
    if (!registry.list().some((provider) => provider.id === body.providerId)) return c.json({ error: 'Unknown provider' }, 400);
    await userRepo.ensureUser(userId, 'Espera User');
    const connection = await connectionRepo.upsert({
      id: body.id,
      userId,
      name: String(body.name).slice(0, 100),
      providerId: body.providerId,
      baseUrl: body.baseUrl ? String(body.baseUrl).slice(0, 2048) : null,
      status: body.status === 'error' ? 'error' : 'active',
      lastTestedAt: body.lastTestedAt || null,
      models: body.models.slice(0, 200).map((model: any) => ({ id: String(model.id), name: String(model.name || model.id), contextWindow: Number(model.contextWindow) || 0, supportsStreaming: model.supportsStreaming !== false })),
      apiKey: typeof body.credential?.apiKey === 'string' ? body.credential.apiKey : undefined,
      rememberCredential: body.rememberCredential === true,
      masterKey: credentialEncryptionKey,
    });
    return c.json({ connection }, 201);
  });

  router.delete('/connections/:id', async (c) => {
    const userId = requestUserId(c);
    await userRepo.ensureUser(userId, 'Espera User');
    const removed = await connectionRepo.remove(c.req.param('id'), userId);
    return removed ? c.body(null, 204) : c.json({ error: 'Connection not found' }, 404);
  });

  router.post('/connections/:id/validate', async (c) => {
    const userId = requestUserId(c);
    const id = c.req.param('id');
    const providerId = await connectionRepo.getProviderId(id, userId);
    if (!providerId) return c.json({ error: 'Connection not found' }, 404);
    try {
      const credential = await connectionRepo.getCredential(id, userId, credentialEncryptionKey);
      if (!credential?.apiKey) return c.json({ error: 'This connection has no encrypted credential. Enter the API key again.' }, 409);
      const isValid = await registry.get(providerId).validateCredential(credential);
      return c.json({ isValid, testedAt: new Date().toISOString() });
    } catch (error) {
      const providerError = error as ProviderError;
      return c.json({ error: providerError.message || 'Connection validation failed', code: providerError.code || 'unknown_error' }, providerErrorStatus(providerError));
    }
  });

  return router;
}
