import type { D1Database, D1PreparedStatement } from './d1-interface.js';

export interface SqlJsDatabase {
  exec(sql: string): void;
  prepare(sql: string, params?: unknown[]): any;
  run(sql: string, params?: unknown[]): void;
  getRowsModified(): number;
  export?(): Uint8Array;
}

export class SqlJsD1Adapter implements D1Database {
  constructor(private sqlDb: SqlJsDatabase) {}

  prepare(query: string): D1PreparedStatement {
    return new SqlJsPreparedStatement(this.sqlDb, query);
  }

  async batch(statements: D1PreparedStatement[]): Promise<unknown[]> {
    this.sqlDb.run('BEGIN TRANSACTION;');
    try {
      const results: unknown[] = [];
      for (const stmt of statements) {
        results.push(await stmt.run());
      }
      this.sqlDb.run('COMMIT;');
      return results;
    } catch (err) {
      this.sqlDb.run('ROLLBACK;');
      throw err;
    }
  }

  async exec(query: string): Promise<void> {
    this.sqlDb.exec(query);
  }

  export(): Uint8Array {
    if (!this.sqlDb.export) throw new Error('This SQLite adapter cannot export its database');
    return this.sqlDb.export();
  }
}

class SqlJsPreparedStatement implements D1PreparedStatement {
  private boundValues: unknown[] = [];

  constructor(
    private sqlDb: SqlJsDatabase,
    private query: string
  ) {}

  bind(...values: unknown[]): D1PreparedStatement {
    this.boundValues = values.map((val) => {
      if (typeof val === 'boolean') return val ? 1 : 0;
      if (val === undefined) return null;
      return val;
    });
    return this;
  }

  async first<T = unknown>(colName?: string): Promise<T | null> {
    const res = await this.all<Record<string, unknown>>();
    if (!res.results || res.results.length === 0) {
      return null;
    }
    const firstRow = res.results[0];
    if (colName) {
      return (firstRow[colName] as T) ?? null;
    }
    return firstRow as T;
  }

  async all<T = unknown>(): Promise<{ results: T[]; success: boolean }> {
    const stmt = this.sqlDb.prepare(this.query);
    try {
      if (this.boundValues.length > 0) {
        stmt.bind(this.boundValues);
      }
      const results: T[] = [];
      while (stmt.step()) {
        const row = stmt.getAsObject();
        results.push(row as T);
      }
      return { results, success: true };
    } finally {
      stmt.free();
    }
  }

  async run(): Promise<{ success: boolean; meta: { changes: number } }> {
    const stmt = this.sqlDb.prepare(this.query);
    try {
      if (this.boundValues.length > 0) {
        stmt.bind(this.boundValues);
      }
      stmt.step();
      return {
        success: true,
        // sql.js returns the number of rows changed by the most recent statement,
        // not a cumulative counter. This mirrors D1's meta.changes semantics.
        meta: { changes: this.sqlDb.getRowsModified() },
      };
    } finally {
      stmt.free();
    }
  }
}
