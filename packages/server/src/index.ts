import { createApp } from './app.js';
import type { D1Database } from './db/d1-interface.js';
import { setEndpointPolicy } from './providers/http.js';

export interface Env {
  DB: D1Database;
  ESPERA_MASTER_ENCRYPTION_KEY?: string;
  ESPERA_ALLOWED_ORIGIN?: string;
  ESPERA_AUTH_MODE?: 'required' | 'optional' | 'disabled';
  GITHUB_CLIENT_ID?: string;
  GITHUB_CLIENT_SECRET?: string;
  GITHUB_OAUTH_REDIRECT_URI?: string;
  ESPERA_FRONTEND_ORIGIN?: string;
  ESPERA_ENDPOINT_POLICY?: string;
}

export default {
  async fetch(request: Request, env: Env, ctx: any): Promise<Response> {
    setEndpointPolicy(env.ESPERA_ENDPOINT_POLICY);
    const app = createApp(env.DB, undefined, {
      allowedOrigin: env.ESPERA_ALLOWED_ORIGIN,
      mode: env.ESPERA_AUTH_MODE,
      githubClientId: env.GITHUB_CLIENT_ID,
      githubClientSecret: env.GITHUB_CLIENT_SECRET,
      githubRedirectUri: env.GITHUB_OAUTH_REDIRECT_URI,
      frontendOrigin: env.ESPERA_FRONTEND_ORIGIN || env.ESPERA_ALLOWED_ORIGIN,
    });
    return app.fetch(request, env, ctx);
  },
};

export { createApp };
