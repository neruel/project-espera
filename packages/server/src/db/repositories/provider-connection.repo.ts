import type { ModelDescriptor } from '@espera/shared';
import type { ProviderCredential } from '@espera/shared';
import type { D1Database } from '../d1-interface.js';
import { decryptSecret, encryptSecret } from '../../security/crypto.js';

export interface ProviderConnectionRecord {
  id: string;
  userId: string;
  name: string;
  providerId: string;
  baseUrl?: string;
  status: 'active' | 'inactive' | 'error';
  lastTestedAt: string | null;
  models: ModelDescriptor[];
  credentialStored: boolean;
  createdAt: string;
  updatedAt: string;
}

export class ProviderConnectionRepository {
  constructor(private db: D1Database) {}

  async list(userId: string): Promise<ProviderConnectionRecord[]> {
    const rows = await this.db.prepare(`
      SELECT id, user_id as userId, display_name as name, provider_id as providerId,
             endpoint_url as baseUrl, status, last_tested_at as lastTestedAt,
             CASE WHEN auth_mode = 'encrypted' AND encrypted_secret IS NOT NULL THEN 1 ELSE 0 END as credentialStored,
             created_at as createdAt, updated_at as updatedAt
      FROM provider_connections WHERE user_id = ? ORDER BY updated_at DESC
    `).bind(userId).all<any>();
    const result: ProviderConnectionRecord[] = [];
    for (const row of rows.results || []) {
      const models = await this.db.prepare(`
        SELECT provider_model_id as id, display_name as name, context_window as contextWindow,
               supports_streaming as supportsStreaming
        FROM provider_connection_models WHERE connection_id = ? AND available = 1
        ORDER BY display_name
      `).bind(row.id).all<any>();
      result.push({
        ...row,
        credentialStored: Boolean(row.credentialStored),
        models: (models.results || []).map((model) => ({
          ...model,
          supportsStreaming: Boolean(model.supportsStreaming),
        })),
      });
    }
    return result;
  }

  async upsert(input: {
    id?: string;
    userId: string;
    name: string;
    providerId: string;
    baseUrl?: string | null;
    status?: 'active' | 'inactive' | 'error';
    lastTestedAt?: string | null;
    models: ModelDescriptor[];
    apiKey?: string;
    rememberCredential?: boolean;
    masterKey?: string;
  }): Promise<ProviderConnectionRecord> {
    const existing = input.id ? await this.db.prepare('SELECT id, auth_mode as authMode, encrypted_secret as encryptedSecret, encryption_version as encryptionVersion, nonce FROM provider_connections WHERE id = ? AND user_id = ?').bind(input.id, input.userId).first<any>() : null;
    // Never reuse a client-supplied id the caller does not own (it may belong to another user).
    const id: string = existing?.id ?? `conn_${crypto.randomUUID()}`;
    let encryptedSecret: { ciphertext: string; nonce: string; version: number } | null = null;
    if (input.rememberCredential && input.apiKey) {
      if (!input.apiKey || !input.masterKey) throw new Error('Persistent credential storage is not configured or the API key is missing');
      encryptedSecret = await encryptSecret(input.apiKey, input.masterKey);
    } else if (input.rememberCredential && !existing?.encryptedSecret) {
      throw new Error('Persistent credential storage is not configured or the API key is missing');
    }
    if (existing) {
      const preserveCredential = !input.apiKey && existing.authMode === 'encrypted';
      await this.db.prepare(`UPDATE provider_connections SET display_name = ?, provider_id = ?, endpoint_url = ?, auth_mode = ?, encrypted_secret = ?, encryption_version = ?, nonce = ?, status = ?, last_tested_at = ?, updated_at = datetime('now') WHERE id = ? AND user_id = ?`)
        .bind(input.name, input.providerId, input.baseUrl ?? null, encryptedSecret ? 'encrypted' : preserveCredential ? existing.authMode : 'session', encryptedSecret?.ciphertext ?? (preserveCredential ? existing.encryptedSecret : null), encryptedSecret?.version ?? (preserveCredential ? existing.encryptionVersion : null), encryptedSecret?.nonce ?? (preserveCredential ? existing.nonce : null), input.status ?? 'active', input.lastTestedAt ?? null, id, input.userId).run();
      await this.db.prepare('DELETE FROM provider_connection_models WHERE connection_id = ?').bind(id).run();
    } else {
      await this.db.prepare(`INSERT INTO provider_connections (id, user_id, provider_id, display_name, endpoint_url, auth_mode, encrypted_secret, encryption_version, nonce, status, last_tested_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .bind(id, input.userId, input.providerId, input.name, input.baseUrl ?? null, encryptedSecret ? 'encrypted' : 'session', encryptedSecret?.ciphertext ?? null, encryptedSecret?.version ?? null, encryptedSecret?.nonce ?? null, input.status ?? 'active', input.lastTestedAt ?? null).run();
    }
    for (const model of input.models) {
      await this.db.prepare(`INSERT INTO provider_connection_models (id, connection_id, provider_model_id, display_name, source, supports_streaming, available, context_window, last_seen_at) VALUES (?, ?, ?, ?, 'remote', ?, 1, ?, datetime('now'))`)
        .bind(`conn_model_${crypto.randomUUID()}`, id, model.id, model.name, model.supportsStreaming ? 1 : 0, model.contextWindow || 0).run();
    }
    return (await this.list(input.userId)).find((connection) => connection.id === id)!;
  }

  async remove(id: string, userId: string): Promise<boolean> {
    const existing = await this.db.prepare('SELECT id FROM provider_connections WHERE id = ? AND user_id = ?').bind(id, userId).first();
    if (!existing) return false;
    await this.db.prepare('DELETE FROM provider_connections WHERE id = ? AND user_id = ?').bind(id, userId).run();
    return true;
  }

  async getCredential(id: string, userId: string, masterKey?: string): Promise<ProviderCredential | null> {
    const row = await this.db.prepare(`SELECT endpoint_url as endpointUrl, auth_mode as authMode, encrypted_secret as encryptedSecret, nonce, encryption_version as encryptionVersion FROM provider_connections WHERE id = ? AND user_id = ?`).bind(id, userId).first<any>();
    if (!row?.encryptedSecret || row.authMode !== 'encrypted') return null;
    if (!masterKey || !row.nonce) throw new Error('Persistent credential storage is not configured');
    return { apiKey: await decryptSecret(row.encryptedSecret, row.nonce, masterKey), endpointUrl: row.endpointUrl || undefined };
  }

  async getProviderId(id: string, userId: string): Promise<string | null> {
    const row = await this.db.prepare('SELECT provider_id as providerId FROM provider_connections WHERE id = ? AND user_id = ?')
      .bind(id, userId).first<{ providerId: string }>();
    return row?.providerId ?? null;
  }
}
