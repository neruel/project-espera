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

    return (await this.getMemoryById(id, data.userId))!;
  }

  async getMemoryById(id: string, userId: string): Promise<Memory | null> {
    const row = await this.db
      .prepare(
        `SELECT id, user_id as userId, project_id as projectId, type, subject, predicate,
                value_json, canonical_text as canonicalText, source_kind as sourceKind,
                confidence, importance, sensitivity, status, valid_from as validFrom,
                valid_until as validUntil, created_at as createdAt, updated_at as updatedAt
         FROM memories
          WHERE id = ? AND user_id = ?`
      )
      .bind(id, userId)
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
      query?: string;
      limit?: number;
      offset?: number;
      sort?: 'updated' | 'importance' | 'confidence';
      history?: boolean;
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
    } else if (!filters?.history) {
      // By default exclude soft-deleted memories
      query += ` AND status != 'deleted'`;
    }
    if (filters?.history) query += ` AND status NOT IN ('pending', 'active')`;

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

    if (filters?.query) {
      query += ` AND (canonical_text LIKE ? ESCAPE '\\' OR subject LIKE ? ESCAPE '\\' OR predicate LIKE ? ESCAPE '\\')`;
      const escaped = filters.query.replace(/[\\%_]/g, '\\$&');
      params.push(`%${escaped}%`, `%${escaped}%`, `%${escaped}%`);
    }

    query += filters?.sort === 'confidence' ? ` ORDER BY confidence DESC, updated_at DESC` : filters?.sort === 'updated' ? ` ORDER BY updated_at DESC, rowid DESC` : ` ORDER BY importance DESC, updated_at DESC`;
    if (filters?.limit) { query += ` LIMIT ? OFFSET ?`; params.push(filters.limit, filters.offset ?? 0); }

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

  async approveMemory(id: string, userId: string, changeReason: string = 'User approved', actor: 'user' | 'system' = 'user'): Promise<Memory> {
    const current = await this.getMemoryById(id, userId);
    if (!current) throw new Error(`Memory not found: ${id}`);
    if (current.status === 'active') return current;
    if (current.status !== 'pending') throw new Error('Only pending memories can be approved');

    const transition = await this.db
      .prepare(`UPDATE memories SET status = 'active', updated_at = datetime('now') WHERE id = ? AND user_id = ? AND status = 'pending'`)
      .bind(id, userId)
      .run();
    if ((transition.meta?.changes ?? 0) === 0) return (await this.getMemoryById(id, userId))!;

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

    return (await this.getMemoryById(id, userId))!;
  }

  async editAndApproveMemory(
    id: string,
    userId: string,
    update: {
      canonicalText: string;
      importance?: number;
      type?: MemoryType;
      changeReason: string;
    },
    actor: 'user' | 'system' = 'user'
  ): Promise<Memory> {
    const current = await this.getMemoryById(id, userId);
    if (!current) throw new Error(`Memory not found: ${id}`);
    if (current.status !== 'pending' && current.status !== 'active') throw new Error('Only pending or active memories can be edited');

    const importance = update.importance ?? current.importance;
    const type = update.type ?? current.type;

    const result = await this.db
      .prepare(
        `UPDATE memories
         SET status = 'active', canonical_text = ?, importance = ?, type = ?, updated_at = datetime('now')
         WHERE id = ? AND user_id = ? AND status IN ('pending', 'active')`
      )
      .bind(update.canonicalText, importance, type, id, userId)
      .run();
    if ((result.meta?.changes ?? 0) === 0) throw new Error(`Memory not found: ${id}`);

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

    return (await this.getMemoryById(id, userId))!;
  }

  async rejectMemory(id: string, userId: string, reason: string = 'User rejected', actor: 'user' | 'system' = 'user'): Promise<Memory> {
    const current = await this.getMemoryById(id, userId);
    if (!current) throw new Error(`Memory not found: ${id}`);

    if (current.status === 'rejected') return current;
    if (current.status !== 'pending') throw new Error('Only pending memories can be rejected');
    const transition = await this.db
      .prepare(`UPDATE memories SET status = 'rejected', updated_at = datetime('now') WHERE id = ? AND user_id = ? AND status = 'pending'`)
      .bind(id, userId)
      .run();
    if ((transition.meta?.changes ?? 0) === 0) return (await this.getMemoryById(id, userId))!;

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

    return (await this.getMemoryById(id, userId))!;
  }

  async softDeleteMemory(id: string, userId: string, reason: string = 'Soft deleted by user', actor: 'user' | 'system' = 'user'): Promise<Memory> {
    const current = await this.getMemoryById(id, userId);
    if (!current) throw new Error(`Memory not found: ${id}`);

    if (current.status === 'deleted') return current;
    const transition = await this.db
      .prepare(`UPDATE memories SET status = 'deleted', updated_at = datetime('now') WHERE id = ? AND user_id = ? AND status != 'deleted'`)
      .bind(id, userId)
      .run();
    if ((transition.meta?.changes ?? 0) === 0) return (await this.getMemoryById(id, userId))!;

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

    return (await this.getMemoryById(id, userId))!;
  }

  async hardDeleteMemory(id: string, userId: string): Promise<boolean> {
    const result = await this.db.prepare(`DELETE FROM memories WHERE id = ? AND user_id = ?`).bind(id, userId).run();
    return result.meta.changes > 0;
  }

  async getRevisions(memoryId: string, userId: string): Promise<MemoryRevision[]> {
    const res = await this.db
      .prepare(
        `SELECT r.id, r.memory_id as memoryId, r.previous_status as previousStatus,
                r.new_status as newStatus, r.previous_canonical_text as previousCanonicalText,
                r.new_canonical_text as newCanonicalText, r.change_reason as changeReason,
                r.actor, r.created_at as createdAt
          FROM memory_revisions r
          INNER JOIN memories m ON m.id = r.memory_id
          WHERE r.memory_id = ? AND m.user_id = ?
          ORDER BY r.rowid DESC`
      )
      .bind(memoryId, userId)
      .all<MemoryRevision>();
    return res.results || [];
  }

  async getEvidence(memoryId: string, userId: string): Promise<MemoryEvidence[]> {
    const res = await this.db
      .prepare(
        `SELECT e.id, e.memory_id as memoryId, e.message_id as messageId, e.snippet,
                msg.conversation_id as conversationId, e.created_at as createdAt
          FROM memory_evidence e
          INNER JOIN memories m ON m.id = e.memory_id
          INNER JOIN messages msg ON msg.id = e.message_id
          WHERE e.memory_id = ? AND m.user_id = ?`
      )
      .bind(memoryId, userId)
      .all<MemoryEvidence>();
    return res.results || [];
  }
}
