import type { D1Database } from '../d1-interface.js';
import type {
  Memory,
  MemoryEvidence,
  MemoryRevision,
  MemoryStatus,
  MemoryType,
} from '@espera/shared';

export class MemoryRepository {
  constructor(private db: D1Database) {}

  async createCandidate(data: {
    userId: string;
    projectId?: string | null;
    type: MemoryType;
    subject: string;
    predicate: string;
    valueJson: Record<string, unknown> | string | number | boolean;
    canonicalText: string;
    sourceKind?: string;
    confidence?: number;
    importance?: number;
    sensitivity?: 'low' | 'medium' | 'high';
    evidenceSnippet?: string;
    messageId?: string;
  }): Promise<Memory> {
    const id = `mem_${crypto.randomUUID()}`;
    const valueJsonStr =
      typeof data.valueJson === 'string'
        ? data.valueJson
        : JSON.stringify(data.valueJson);

    await this.db
      .prepare(
        `INSERT INTO memories (
          id, user_id, project_id, type, subject, predicate, value_json,
          canonical_text, source_kind, confidence, importance, sensitivity, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`
      )
      .bind(
        id,
        data.userId,
        data.projectId ?? null,
        data.type,
        data.subject,
        data.predicate,
        valueJsonStr,
        data.canonicalText,
        data.sourceKind ?? 'inferred_from_conversation',
        data.confidence ?? 1.0,
        data.importance ?? 3,
        data.sensitivity ?? 'medium'
      )
      .run();

    // Link evidence if messageId and snippet are present
    if (data.messageId && data.evidenceSnippet) {
      await this.db
        .prepare(
          `INSERT INTO memory_evidence (id, memory_id, message_id, snippet)
           VALUES (?, ?, ?, ?)`
        )
        .bind(`ev_${crypto.randomUUID()}`, id, data.messageId, data.evidenceSnippet)
        .run();
    }

    // Record creation revision
    await this.db
      .prepare(
        `INSERT INTO memory_revisions (id, memory_id, previous_status, new_status, previous_canonical_text, new_canonical_text, change_reason, actor)
         VALUES (?, ?, NULL, 'pending', NULL, ?, 'Created candidate from extraction', 'system')`
      )
      .bind(`rev_${crypto.randomUUID()}`, id, data.canonicalText)
      .run();

    return (await this.getMemoryById(id))!;
  }

  async getMemoryById(id: string): Promise<Memory | null> {
    const row = await this.db
      .prepare(
        `SELECT id, user_id as userId, project_id as projectId, type, subject, predicate,
                value_json, canonical_text as canonicalText, source_kind as sourceKind,
                confidence, importance, sensitivity, status, valid_from as validFrom,
                valid_until as validUntil, created_at as createdAt, updated_at as updatedAt
         FROM memories
         WHERE id = ?`
      )
      .bind(id)
      .first<any>();

    if (!row) return null;

    let parsedVal = row.value_json;
    try {
      parsedVal = JSON.parse(row.value_json);
    } catch {
      // keep as string
    }

    return {
      ...row,
      valueJson: parsedVal,
    };
  }

  async getMemories(
    userId: string,
    filters?: {
      status?: MemoryStatus;
      type?: MemoryType;
      projectId?: string | null;
    }
  ): Promise<Memory[]> {
    let query = `SELECT id, user_id as userId, project_id as projectId, type, subject, predicate,
                        value_json, canonical_text as canonicalText, source_kind as sourceKind,
                        confidence, importance, sensitivity, status, valid_from as validFrom,
                        valid_until as validUntil, created_at as createdAt, updated_at as updatedAt
                 FROM memories
                 WHERE user_id = ?`;
    const params: unknown[] = [userId];

    if (filters?.status) {
      query += ` AND status = ?`;
      params.push(filters.status);
    } else {
      // By default exclude soft-deleted memories
      query += ` AND status != 'deleted'`;
    }

    if (filters?.type) {
      query += ` AND type = ?`;
      params.push(filters.type);
    }

    if (filters?.projectId !== undefined) {
      if (filters.projectId === null) {
        query += ` AND project_id IS NULL`;
      } else {
        query += ` AND (project_id = ? OR project_id IS NULL)`;
        params.push(filters.projectId);
      }
    }

    query += ` ORDER BY importance DESC, updated_at DESC`;

    const res = await this.db.prepare(query).bind(...params).all<any>();

    return (res.results || []).map((row) => {
      let parsedVal = row.value_json;
      try {
        parsedVal = JSON.parse(row.value_json);
      } catch {
        // string
      }
      return {
        ...row,
        valueJson: parsedVal,
      };
    });
  }

  async getActiveMemories(userId: string, projectId?: string | null): Promise<Memory[]> {
    return this.getMemories(userId, { status: 'active', projectId });
  }

  async approveMemory(id: string, changeReason: string = 'User approved', actor: 'user' | 'system' = 'user'): Promise<Memory> {
    const current = await this.getMemoryById(id);
    if (!current) throw new Error(`Memory not found: ${id}`);
    if (current.status === 'active') return current;

    await this.db
      .prepare(`UPDATE memories SET status = 'active', updated_at = datetime('now') WHERE id = ?`)
      .bind(id)
      .run();

    await this.db
      .prepare(
        `INSERT INTO memory_revisions (id, memory_id, previous_status, new_status, previous_canonical_text, new_canonical_text, change_reason, actor)
         VALUES (?, ?, ?, 'active', ?, ?, ?, ?)`
      )
      .bind(
        `rev_${crypto.randomUUID()}`,
        id,
        current.status,
        current.canonicalText,
        current.canonicalText,
        changeReason,
        actor
      )
      .run();

    return (await this.getMemoryById(id))!;
  }

  async editAndApproveMemory(
    id: string,
    update: {
      canonicalText: string;
      importance?: number;
      type?: MemoryType;
      changeReason: string;
    },
    actor: 'user' | 'system' = 'user'
  ): Promise<Memory> {
    const current = await this.getMemoryById(id);
    if (!current) throw new Error(`Memory not found: ${id}`);

    const importance = update.importance ?? current.importance;
    const type = update.type ?? current.type;

    await this.db
      .prepare(
        `UPDATE memories
         SET status = 'active', canonical_text = ?, importance = ?, type = ?, updated_at = datetime('now')
         WHERE id = ?`
      )
      .bind(update.canonicalText, importance, type, id)
      .run();

    await this.db
      .prepare(
        `INSERT INTO memory_revisions (id, memory_id, previous_status, new_status, previous_canonical_text, new_canonical_text, change_reason, actor)
         VALUES (?, ?, ?, 'active', ?, ?, ?, ?)`
      )
      .bind(
        `rev_${crypto.randomUUID()}`,
        id,
        current.status,
        current.canonicalText,
        update.canonicalText,
        update.changeReason,
        actor
      )
      .run();

    return (await this.getMemoryById(id))!;
  }

  async rejectMemory(id: string, reason: string = 'User rejected', actor: 'user' | 'system' = 'user'): Promise<Memory> {
    const current = await this.getMemoryById(id);
    if (!current) throw new Error(`Memory not found: ${id}`);

    await this.db
      .prepare(`UPDATE memories SET status = 'rejected', updated_at = datetime('now') WHERE id = ?`)
      .bind(id)
      .run();

    await this.db
      .prepare(
        `INSERT INTO memory_revisions (id, memory_id, previous_status, new_status, previous_canonical_text, new_canonical_text, change_reason, actor)
         VALUES (?, ?, ?, 'rejected', ?, ?, ?, ?)`
      )
      .bind(
        `rev_${crypto.randomUUID()}`,
        id,
        current.status,
        current.canonicalText,
        current.canonicalText,
        reason,
        actor
      )
      .run();

    return (await this.getMemoryById(id))!;
  }

  async softDeleteMemory(id: string, reason: string = 'Soft deleted by user', actor: 'user' | 'system' = 'user'): Promise<Memory> {
    const current = await this.getMemoryById(id);
    if (!current) throw new Error(`Memory not found: ${id}`);

    await this.db
      .prepare(`UPDATE memories SET status = 'deleted', updated_at = datetime('now') WHERE id = ?`)
      .bind(id)
      .run();

    await this.db
      .prepare(
        `INSERT INTO memory_revisions (id, memory_id, previous_status, new_status, previous_canonical_text, new_canonical_text, change_reason, actor)
         VALUES (?, ?, ?, 'deleted', ?, ?, ?, ?)`
      )
      .bind(
        `rev_${crypto.randomUUID()}`,
        id,
        current.status,
        current.canonicalText,
        current.canonicalText,
        reason,
        actor
      )
      .run();

    return (await this.getMemoryById(id))!;
  }

  async hardDeleteMemory(id: string): Promise<boolean> {
    await this.db.prepare(`DELETE FROM memories WHERE id = ?`).bind(id).run();
    return true;
  }

  async getRevisions(memoryId: string): Promise<MemoryRevision[]> {
    const res = await this.db
      .prepare(
        `SELECT id, memory_id as memoryId, previous_status as previousStatus,
                new_status as newStatus, previous_canonical_text as previousCanonicalText,
                new_canonical_text as newCanonicalText, change_reason as changeReason,
                actor, created_at as createdAt
         FROM memory_revisions
         WHERE memory_id = ?
         ORDER BY rowid DESC`
      )
      .bind(memoryId)
      .all<MemoryRevision>();
    return res.results || [];
  }

  async getEvidence(memoryId: string): Promise<MemoryEvidence[]> {
    const res = await this.db
      .prepare(
        `SELECT id, memory_id as memoryId, message_id as messageId, snippet,
                created_at as createdAt
         FROM memory_evidence
         WHERE memory_id = ?`
      )
      .bind(memoryId)
      .all<MemoryEvidence>();
    return res.results || [];
  }
}
