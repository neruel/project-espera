import initSqlJs from 'sql.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SqlJsD1Adapter } from '../db/sqljs-adapter.js';
import type { D1Database } from '../db/d1-interface.js';

export async function createTestDatabase(options: { filePath?: string } = {}): Promise<D1Database> {
  const SQL = await initSqlJs();
  const existing = options.filePath && fs.existsSync(options.filePath)
    ? new Uint8Array(fs.readFileSync(options.filePath))
    : undefined;
  const db = new SQL.Database(existing);
  db.exec('PRAGMA foreign_keys = ON');

  // Find and read migration schema
  const migrationDir = path.basename(process.cwd()) === 'server'
    ? path.resolve(process.cwd(), 'migrations')
    : path.resolve(process.cwd(), 'packages/server/migrations');
  for (const file of fs.readdirSync(migrationDir).filter((x) => x.endsWith('.sql')).sort()) {
    // The local adapter replays migrations against its persisted SQLite file.
    // D1 tracks migrations remotely, while this lightweight adapter does not;
    // skip the additive metadata migration once its columns are present.
    if (file === '0003_provider_connection_metadata.sql' || file === '0004_auth_sessions.sql') {
      const tableInfo = db.exec('PRAGMA table_info(provider_connections)');
      const columns = new Set((tableInfo[0]?.values || []).map((row: unknown[]) => String(row[1])));
      const userInfo = db.exec('PRAGMA table_info(users)');
      const userColumns = new Set((userInfo[0]?.values || []).map((row: unknown[]) => String(row[1])));
      if (file === '0003_provider_connection_metadata.sql' && columns.has('display_name') && columns.has('endpoint_url')) continue;
      if (file === '0004_auth_sessions.sql' && userColumns.has('provider_subject')) continue;
    }
    db.exec(fs.readFileSync(path.join(migrationDir, file), 'utf8'));
  }

  if (options.filePath) {
    fs.mkdirSync(path.dirname(options.filePath), { recursive: true });
    const originalClose = (db as any).close?.bind(db);
    if (originalClose) (db as any).close = () => {
      fs.writeFileSync(options.filePath!, Buffer.from((db as any).export()));
      originalClose();
    };
  }

  return new SqlJsD1Adapter(db as any);
}
