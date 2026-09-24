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

    return (await this.getConversation(id, userId))!;
  }

  async getConversation(id: string, userId: string): Promise<Conversation | null> {
    const row = await this.db
      .prepare(
        `SELECT id, user_id as userId, project_id as projectId, title,
                created_at as createdAt, updated_at as updatedAt
         FROM conversations
         WHERE id = ? AND user_id = ?`
      )
      .bind(id, userId)
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

  async updateProject(id: string, userId: string, projectId: string | null): Promise<Conversation | null> {
    const result = await this.db
      .prepare("UPDATE conversations SET project_id = ?, updated_at = datetime('now') WHERE id = ? AND user_id = ?")
      .bind(projectId, id, userId)
      .run();
    if ((result.meta?.changes ?? 0) === 0) return null;
    return this.getConversation(id, userId);
  }

  async updateTitle(id: string, userId: string, title: string): Promise<Conversation | null> {
    const result = await this.db
      .prepare("UPDATE conversations SET title = ?, updated_at = datetime('now') WHERE id = ? AND user_id = ?")
      .bind(title, id, userId)
      .run();
    if ((result.meta?.changes ?? 0) === 0) return null;
    return this.getConversation(id, userId);
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

  async deleteMessage(id: string, conversationId: string): Promise<boolean> {
    const result = await this.db
      .prepare('DELETE FROM messages WHERE id = ? AND conversation_id = ?')
      .bind(id, conversationId)
      .run();
    return (result.meta?.changes ?? 0) > 0;
  }

  async getMessage(id: string, conversationId: string): Promise<Message | null> {
    return this.db.prepare(`SELECT id, conversation_id as conversationId, role, content, provider_id as providerId, model_id as modelId, token_count as tokenCount, created_at as createdAt FROM messages WHERE id = ? AND conversation_id = ?`)
      .bind(id, conversationId).first<Message>();
  }

  async getPreviousUserMessage(messageId: string, conversationId: string): Promise<Message | null> {
    return this.db.prepare(`SELECT id, conversation_id as conversationId, role, content, provider_id as providerId, model_id as modelId, token_count as tokenCount, created_at as createdAt FROM messages WHERE conversation_id = ? AND role = 'user' AND rowid < (SELECT rowid FROM messages WHERE id = ? AND conversation_id = ?) ORDER BY rowid DESC LIMIT 1`)
      .bind(conversationId, messageId, conversationId).first<Message>();
  }

  async updateMessage(id: string, conversationId: string, input: { content: string; providerId?: string; modelId?: string }): Promise<Message> {
    await this.db.prepare(`UPDATE messages SET content = ?, provider_id = ?, model_id = ? WHERE id = ? AND conversation_id = ?`)
      .bind(input.content, input.providerId ?? null, input.modelId ?? null, id, conversationId).run();
    return (await this.getMessage(id, conversationId))!;
  }

  async getRecentMessages(conversationId: string, limit: number = 10, offset: number = 0): Promise<Message[]> {
    const res = await this.db
      .prepare(
        `SELECT id, conversation_id as conversationId, role, content,
                provider_id as providerId, model_id as modelId, token_count as tokenCount,
                created_at as createdAt
         FROM messages
         WHERE conversation_id = ?
         ORDER BY created_at DESC, rowid DESC
         LIMIT ? OFFSET ?`
      )
      .bind(conversationId, limit, offset)
      .all<Message>();

    // return in chronological order
    return (res.results || []).reverse();
  }
}
