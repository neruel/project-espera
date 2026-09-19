import type { ModelDescriptor } from '@espera/shared';
import type { D1Database } from '../d1-interface.js';

export interface ProviderConnectionRecord {
  id: string;
  userId: string;
  name: string;
  providerId: string;
  baseUrl?: string;
  status: 'active' | 'inactive' | 'error';
  lastTestedAt: string | null;
  models: ModelDescriptor[];
  createdAt: string;
  updatedAt: string;
}

export class ProviderConnectionRepository {
  constructor(private db: D1Database) {}

  async list(userId: string): Promise<ProviderConnectionRecord[]> {
    const rows = await this.db.prepare(`
      SELECT id, user_id as userId, display_name as name, provider_id as providerId,
             endpoint_url as baseUrl, status, last_tested_at as lastTestedAt,
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
  }): Promise<ProviderConnectionRecord> {
    const id = input.id || `conn_${crypto.randomUUID()}`;
    const existing = await this.db.prepare('SELECT id FROM provider_connections WHERE id = ? AND user_id = ?').bind(id, input.userId).first();
    if (existing) {
      await this.db.prepare(`UPDATE provider_connections SET display_name = ?, provider_id = ?, endpoint_url = ?, status = ?, last_tested_at = ?, updated_at = datetime('now') WHERE id = ? AND user_id = ?`)
        .bind(input.name, input.providerId, input.baseUrl ?? null, input.status ?? 'active', input.lastTestedAt ?? null, id, input.userId).run();
      await this.db.prepare('DELETE FROM provider_connection_models WHERE connection_id = ?').bind(id).run();
    } else {
      await this.db.prepare(`INSERT INTO provider_connections (id, user_id, provider_id, display_name, endpoint_url, auth_mode, status, last_tested_at) VALUES (?, ?, ?, ?, ?, 'session', ?, ?)`)
        .bind(id, input.userId, input.providerId, input.name, input.baseUrl ?? null, input.status ?? 'active', input.lastTestedAt ?? null).run();
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
}
