import path from 'node:path';
import fs from 'node:fs';
import { createTestDatabase } from '../test-utils/test-db.js';
import type { D1Database } from './d1-interface.js';
export const localDbPath=path.resolve(process.cwd(),'packages/server/.data/espera.local.sqlite');
export async function createLocalDatabase():Promise<D1Database>{fs.mkdirSync(path.dirname(localDbPath),{recursive:true});const db=await createTestDatabase({filePath:localDbPath});const bytes=(db as any).export?.();if(bytes)fs.writeFileSync(localDbPath,Buffer.from(bytes));return db;}
