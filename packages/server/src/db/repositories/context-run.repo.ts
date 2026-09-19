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

  async getLatestRun(conversationId: string): Promise<ContextRun | null> {
    const row = await this.db
      .prepare(
        `SELECT id, conversation_id as conversationId, message_id as messageId,
                provider_id as providerId, model_id as modelId, persona_version as personaVersion,
                selected_memory_ids_json, selection_reasons_json, assembled_prompt as assembledPrompt,
                token_estimate as tokenEstimate, created_at as createdAt
         FROM context_runs
         WHERE conversation_id = ?
         ORDER BY created_at DESC
         LIMIT 1`
      )
      .bind(conversationId)
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
