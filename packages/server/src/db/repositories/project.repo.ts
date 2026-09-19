import type { Project } from '@espera/shared';
import type { D1Database } from '../d1-interface.js';

export class ProjectRepository {
  constructor(private db: D1Database) {}

  async list(userId: string): Promise<Project[]> {
    const result = await this.db.prepare(`SELECT id, user_id as userId, name, description, status, created_at as createdAt, updated_at as updatedAt FROM projects WHERE user_id = ? ORDER BY updated_at DESC`).bind(userId).all<Project>();
    return result.results || [];
  }

  async get(id: string, userId: string): Promise<Project | null> {
    return this.db.prepare(`SELECT id, user_id as userId, name, description, status, created_at as createdAt, updated_at as updatedAt FROM projects WHERE id = ? AND user_id = ?`).bind(id, userId).first<Project>();
  }

  async create(userId: string, name: string, description: string): Promise<Project> {
    const id = `project_${crypto.randomUUID()}`;
    await this.db.prepare('INSERT INTO projects (id, user_id, name, description) VALUES (?, ?, ?, ?)').bind(id, userId, name, description).run();
    return (await this.get(id, userId))!;
  }

  async update(id: string, userId: string, input: { name: string; description: string; status: Project['status'] }): Promise<Project | null> {
    const existing = await this.get(id, userId);
    if (!existing) return null;
    await this.db.prepare(`UPDATE projects SET name = ?, description = ?, status = ?, updated_at = datetime('now') WHERE id = ? AND user_id = ?`).bind(input.name, input.description, input.status, id, userId).run();
    return this.get(id, userId);
  }

  async remove(id: string, userId: string): Promise<boolean> {
    const existing = await this.get(id, userId);
    if (!existing) return false;
    await this.db.prepare('DELETE FROM projects WHERE id = ? AND user_id = ?').bind(id, userId).run();
    return true;
  }
}
