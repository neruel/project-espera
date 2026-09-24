import type { D1Database } from '../d1-interface.js';
import type { ContextRun } from '@espera/shared';

export class ContextRunRepository {
  constructor(private db: D1Database) {}

  async saveRun(run: ContextRun): Promise<void> {
    await this.db
      .prepare(
        `INSERT INTO context_runs (
          id, conversation_id, message_id, provider_id, model_id, persona_version,
          selected_memory_ids_json, selection_reasons_json, assembled_prompt, token_estimate
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        run.id,
        run.conversationId,
        run.messageId,
        run.providerId,
        run.modelId,
        run.personaVersion,
        JSON.stringify(run.selectedMemoryIds),
        JSON.stringify(run.selectionReasons),
        run.assembledPrompt,
        run.tokenEstimate
      )
      .run();
  }

  async getLatestRun(conversationId: string, userId: string): Promise<ContextRun | null> {
    const row = await this.db
      .prepare(
        `SELECT cr.id, cr.conversation_id as conversationId, cr.message_id as messageId,
                cr.provider_id as providerId, cr.model_id as modelId, cr.persona_version as personaVersion,
                cr.selected_memory_ids_json, cr.selection_reasons_json, cr.assembled_prompt as assembledPrompt,
                cr.token_estimate as tokenEstimate, cr.created_at as createdAt
         FROM context_runs cr
         JOIN conversations c ON c.id = cr.conversation_id
         WHERE cr.conversation_id = ? AND c.user_id = ?
         ORDER BY cr.created_at DESC, cr.rowid DESC
         LIMIT 1`
      )
      .bind(conversationId, userId)
      .first<any>();

    if (!row) return null;

    return {
      ...row,
      selectedMemoryIds: JSON.parse(row.selected_memory_ids_json || '[]'),
      selectionReasons: JSON.parse(row.selection_reasons_json || '{}'),
    };
  }

  async getRunById(id: string): Promise<ContextRun | null> {
    const row = await this.db
      .prepare(
        `SELECT id, conversation_id as conversationId, message_id as messageId,
                provider_id as providerId, model_id as modelId, persona_version as personaVersion,
                selected_memory_ids_json, selection_reasons_json, assembled_prompt as assembledPrompt,
                token_estimate as tokenEstimate, created_at as createdAt
         FROM context_runs
         WHERE id = ?`
      )
      .bind(id)
      .first<any>();

    if (!row) return null;

    return {
      ...row,
      selectedMemoryIds: JSON.parse(row.selected_memory_ids_json || '[]'),
      selectionReasons: JSON.parse(row.selection_reasons_json || '{}'),
    };
  }
}
