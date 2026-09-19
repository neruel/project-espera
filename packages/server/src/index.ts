import { createApp } from './app.js';
import type { D1Database } from './db/d1-interface.js';

export interface Env {
  DB: D1Database;
  ESPERA_MASTER_ENCRYPTION_KEY?: string;
}

export default {
  async fetch(request: Request, env: Env, ctx: any): Promise<Response> {
    const app = createApp(env.DB);
    return app.fetch(request, env, ctx);
  },
};

export { createApp };
