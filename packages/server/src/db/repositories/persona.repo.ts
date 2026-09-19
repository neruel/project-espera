import type { D1Database } from '../d1-interface.js';
import type { Persona, PersonaRevision } from '@espera/shared';

export const DEFAULT_PERSONA = {
  name: 'Espera',
  version: 1,
  instructions:
    'You are Espera, a personal continuous AI companion. You maintain an enduring context about the user across conversations and across different underlying LLMs.',
  toneAndManner:
    'Natural, structured, insightful, thoughtful. Do not flatter blindly; provide critical and grounded advice.',
  principles: [
    'Always ground answers in the user known context and project goals.',
    'Distinguish between facts verified by the user and inferences made by AI.',
    'Acknowledge uncertainty instead of hallucinating details.',
    'Be concise, coherent, and maintain continuous personality.',
  ],
};

export class PersonaRepository {
  constructor(private db: D1Database) {}

  async getActivePersona(userId: string): Promise<Persona | null> {
    const row = await this.db
      .prepare(
        `SELECT id, user_id as userId, name, version, instructions,
                tone_and_manner as toneAndManner, principles_json,
                is_active as isActive, created_at as createdAt, updated_at as updatedAt
         FROM personas
         WHERE user_id = ? AND is_active = 1
         LIMIT 1`
      )
      .bind(userId)
      .first<any>();

    if (!row) return null;

    return {
      ...row,
      isActive: Boolean(row.isActive),
      principles: JSON.parse(row.principles_json || '[]'),
    };
  }

  async ensureDefaultPersona(userId: string): Promise<Persona> {
    const existing = await this.getActivePersona(userId);
    if (existing) return existing;

    const id = `persona_${crypto.randomUUID()}`;
    const principlesJson = JSON.stringify(DEFAULT_PERSONA.principles);

    await this.db
      .prepare(
        `INSERT INTO personas (id, user_id, name, version, instructions, tone_and_manner, principles_json, is_active)
         VALUES (?, ?, ?, ?, ?, ?, ?, 1)`
      )
      .bind(
        id,
        userId,
        DEFAULT_PERSONA.name,
        DEFAULT_PERSONA.version,
        DEFAULT_PERSONA.instructions,
        DEFAULT_PERSONA.toneAndManner,
        principlesJson
      )
      .run();

    // Record initial revision
    await this.db
      .prepare(
        `INSERT INTO persona_revisions (id, persona_id, version, instructions, tone_and_manner, principles_json, change_reason)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        `prev_${crypto.randomUUID()}`,
        id,
        DEFAULT_PERSONA.version,
        DEFAULT_PERSONA.instructions,
        DEFAULT_PERSONA.toneAndManner,
        principlesJson,
        'Initial default persona creation'
      )
      .run();

    return (await this.getActivePersona(userId))!;
  }

  async updatePersona(
    userId: string,
    data: {
      name: string;
      instructions: string;
      toneAndManner: string;
      principles: string[];
      changeReason: string;
    }
  ): Promise<Persona> {
    const current = await this.ensureDefaultPersona(userId);
    const nextVersion = current.version + 1;
    const principlesJson = JSON.stringify(data.principles);

    await this.db
      .prepare(
        `UPDATE personas
         SET name = ?, version = ?, instructions = ?, tone_and_manner = ?, principles_json = ?, updated_at = datetime('now')
         WHERE id = ?`
      )
      .bind(data.name, nextVersion, data.instructions, data.toneAndManner, principlesJson, current.id)
      .run();

    await this.db
      .prepare(
        `INSERT INTO persona_revisions (id, persona_id, version, instructions, tone_and_manner, principles_json, change_reason)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        `prev_${crypto.randomUUID()}`,
        current.id,
        nextVersion,
        data.instructions,
        data.toneAndManner,
        principlesJson,
        data.changeReason
      )
      .run();

    return (await this.getActivePersona(userId))!;
  }

  async getRevisions(personaId: string): Promise<PersonaRevision[]> {
    const res = await this.db
      .prepare(
        `SELECT id, persona_id as personaId, version, instructions,
                tone_and_manner as toneAndManner, principles_json,
                change_reason as changeReason, created_at as createdAt
         FROM persona_revisions
         WHERE persona_id = ?
         ORDER BY version DESC`
      )
      .bind(personaId)
      .all<any>();

    return (res.results || []).map((row) => ({
      ...row,
      principles: JSON.parse(row.principles_json || '[]'),
    }));
  }
}
