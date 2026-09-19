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

  // Find and read migration schema
  const migrationDir = path.resolve(
    process.cwd(),
    'packages/server/migrations'
  );
  for (const file of fs.readdirSync(migrationDir).filter((x) => x.endsWith('.sql')).sort()) {
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
