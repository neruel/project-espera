import type { D1Database } from '../d1-interface.js';
import type { Conversation, Message } from '@espera/shared';

export class ConversationRepository {
  constructor(private db: D1Database) {}

  async createConversation(userId: string, title: string = 'New Conversation', projectId?: string | null): Promise<Conversation> {
    const id = `conv_${crypto.randomUUID()}`;
    await this.db
      .prepare(
        `INSERT INTO conversations (id, user_id, project_id, title)
         VALUES (?, ?, ?, ?)`
      )
      .bind(id, userId, projectId ?? null, title)
      .run();

    return (await this.getConversation(id))!;
  }

  async getConversation(id: string, userId?: string): Promise<Conversation | null> {
    const row = await this.db
      .prepare(
        `SELECT id, user_id as userId, project_id as projectId, title,
                created_at as createdAt, updated_at as updatedAt
         FROM conversations
         WHERE id = ?${userId ? ' AND user_id = ?' : ''}`
      )
      .bind(...(userId ? [id, userId] : [id]))
      .first<Conversation>();
    return row ?? null;
  }

  async getConversations(userId: string): Promise<Conversation[]> {
    const res = await this.db
      .prepare(
        `SELECT id, user_id as userId, project_id as projectId, title,
                created_at as createdAt, updated_at as updatedAt
         FROM conversations
         WHERE user_id = ?
         ORDER BY updated_at DESC`
      )
      .bind(userId)
      .all<Conversation>();
    return res.results || [];
  }

  async deleteConversation(id: string, userId: string): Promise<boolean> {
    const result = await this.db
      .prepare('DELETE FROM conversations WHERE id = ? AND user_id = ?')
      .bind(id, userId)
      .run();
    return (result.meta?.changes ?? 0) > 0;
  }

  async addMessage(msg: {
    id?: string;
    conversationId: string;
    role: 'system' | 'user' | 'assistant';
    content: string;
    providerId?: string;
    modelId?: string;
    tokenCount?: number;
  }): Promise<Message> {
    const id = msg.id ?? `msg_${crypto.randomUUID()}`;
    await this.db
      .prepare(
        `INSERT INTO messages (id, conversation_id, role, content, provider_id, model_id, token_count)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        id,
        msg.conversationId,
        msg.role,
        msg.content,
        msg.providerId ?? null,
        msg.modelId ?? null,
        msg.tokenCount ?? null
      )
      .run();

    // Update conversation timestamp
    await this.db
      .prepare(`UPDATE conversations SET updated_at = datetime('now') WHERE id = ?`)
      .bind(msg.conversationId)
      .run();

    const row = await this.db
      .prepare(
        `SELECT id, conversation_id as conversationId, role, content,
                provider_id as providerId, model_id as modelId, token_count as tokenCount,
                created_at as createdAt
         FROM messages
         WHERE id = ?`
      )
      .bind(id)
      .first<Message>();

    return row!;
  }

  async getRecentMessages(conversationId: string, limit: number = 10): Promise<Message[]> {
    const res = await this.db
      .prepare(
        `SELECT id, conversation_id as conversationId, role, content,
                provider_id as providerId, model_id as modelId, token_count as tokenCount,
                created_at as createdAt
         FROM messages
         WHERE conversation_id = ?
         ORDER BY created_at DESC
         LIMIT ?`
      )
      .bind(conversationId, limit)
      .all<Message>();

    // return in chronological order
    return (res.results || []).reverse();
  }
}
