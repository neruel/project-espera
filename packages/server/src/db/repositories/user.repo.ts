import type { D1Database } from '../d1-interface.js';
import type { User } from '@espera/shared';

export class UserRepository {
  constructor(private db: D1Database) {}

  async getUser(id: string): Promise<User | null> {
    const row = await this.db
      .prepare('SELECT id, name, email, created_at as createdAt, updated_at as updatedAt FROM users WHERE id = ?')
      .bind(id)
      .first<User>();
    return row ?? null;
  }

  async ensureUser(id: string, name: string = 'User', email?: string): Promise<User> {
    const existing = await this.getUser(id);
    if (existing) return existing;

    await this.db
      .prepare('INSERT INTO users (id, name, email) VALUES (?, ?, ?)')
      .bind(id, name, email ?? null)
      .run();

    return (await this.getUser(id))!;
  }
}
