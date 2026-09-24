import { serve } from '@hono/node-server';
import { createApp } from './app.js';
import { createLocalDatabase, localDbPath } from './db/local-db.js';
import type { AuthMode } from './auth/service.js';
import fs from 'node:fs';
import path from 'node:path';

async function start() {
  const port = Number(process.env.PORT) || 8787;
  const db = await createLocalDatabase();
  const persist=()=>{const bytes=(db as any).export?.();if(bytes)fs.writeFileSync(localDbPath,Buffer.from(bytes));};
  setInterval(persist,1000);
  process.on('SIGINT',()=>{persist();process.exit(0);});
  process.on('SIGTERM',()=>{persist();process.exit(0);});
  // Local single-user dev (and the e2e suite) runs without login unless ESPERA_AUTH_MODE overrides it.
  const mode = (process.env.ESPERA_AUTH_MODE as AuthMode | undefined) || 'optional';
  const app = createApp(db, undefined, { credentialEncryptionKey: process.env.ESPERA_MASTER_ENCRYPTION_KEY, mode });

  console.log(`[Espera] Local Server Engine booted successfully on http://127.0.0.1:${port}`);
  serve({
    fetch: app.fetch,
    port,
  });
}

start().catch((err) => {
  console.error('[Espera] Failed to start dev server:', err);
  process.exit(1);
});
