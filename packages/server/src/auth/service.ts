import type { User } from '@espera/shared';
import type { D1Database } from '../db/d1-interface.js';

export type AuthMode = 'required' | 'optional' | 'disabled';

export interface AuthConfig {
  mode?: AuthMode;
  githubClientId?: string;
  githubClientSecret?: string;
  githubRedirectUri?: string;
  frontendOrigin?: string;
}

export interface AuthenticatedUser extends User {
  avatarUrl?: string | null;
}

export function requestUserId(context: { get(key: string): unknown }): string {
  const value = context.get('userId');
  return typeof value === 'string' && value.length > 0 ? value : 'user_default';
}

function randomToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes)).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function cookieValue(header: string | undefined, name: string): string | null {
  if (!header) return null;
  const part = header.split(';').map((item) => item.trim()).find((item) => item.startsWith(`${name}=`));
  return part ? decodeURIComponent(part.slice(name.length + 1)) : null;
}

export function cookie(name: string, value: string, options: { maxAge?: number; path?: string; httpOnly?: boolean; sameSite?: string; secure?: boolean } = {}): string {
  const parts = [`${name}=${encodeURIComponent(value)}`, `Path=${options.path || '/'}`];
  if (options.maxAge !== undefined) parts.push(`Max-Age=${options.maxAge}`);
  if (options.httpOnly !== false) parts.push('HttpOnly');
  parts.push(`SameSite=${options.sameSite || 'Lax'}`);
  if (options.secure !== false) parts.push('Secure');
  return parts.join('; ');
}

export class AuthService {
  readonly mode: AuthMode;
  constructor(private db: D1Database, private config: AuthConfig = {}) {
    this.mode = config.mode || 'optional';
  }

  isConfigured(): boolean {
    return Boolean(this.config.githubClientId && this.config.githubClientSecret);
  }

  async currentUser(request: Request): Promise<AuthenticatedUser | null> {
    const raw = cookieValue(request.headers.get('Cookie') || undefined, 'espera_session');
    if (!raw) return null;
    const tokenHash = await sha256(raw);
    const row = await this.db.prepare(`
      SELECT u.id, u.name, u.email, u.avatar_url as avatarUrl, u.created_at as createdAt, u.updated_at as updatedAt,
             s.id as sessionId
      FROM sessions s JOIN users u ON u.id = s.user_id
      WHERE s.token_hash = ? AND s.expires_at > datetime('now')
    `).bind(tokenHash).first<any>();
    if (!row) return null;
    await this.db.prepare(`UPDATE sessions SET last_seen_at = datetime('now') WHERE id = ?`).bind(row.sessionId).run();
    const { sessionId: _sessionId, ...user } = row;
    return user as AuthenticatedUser;
  }

  async beginGithub(request: Request): Promise<Response> {
    if (!this.isConfigured()) return Response.json({ error: 'GitHub OAuth is not configured' }, { status: 503 });
    const requestUrl = new URL(request.url);
    const redirectUri = this.config.githubRedirectUri || `${requestUrl.origin}/api/auth/github/callback`;
    const state = randomToken();
    await this.db.prepare(`INSERT INTO oauth_states (state, provider, redirect_uri, expires_at) VALUES (?, 'github', ?, datetime('now', '+10 minutes'))`).bind(state, redirectUri).run();
    const authorize = new URL('https://github.com/login/oauth/authorize');
    authorize.searchParams.set('client_id', this.config.githubClientId!);
    authorize.searchParams.set('redirect_uri', redirectUri);
    authorize.searchParams.set('scope', 'read:user user:email');
    authorize.searchParams.set('state', state);
    return new Response(null, { status: 302, headers: { Location: authorize.toString(), 'Set-Cookie': cookie('espera_oauth_state', state, { maxAge: 600, path: '/api/auth' }) } });
  }

  async finishGithub(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const state = url.searchParams.get('state');
    const code = url.searchParams.get('code');
    const storedState = cookieValue(request.headers.get('Cookie') || undefined, 'espera_oauth_state');
    if (!state || !code || !storedState || state !== storedState) return new Response('Invalid OAuth state', { status: 400 });
    const stateRow = await this.db.prepare(`SELECT state, redirect_uri as redirectUri FROM oauth_states WHERE state = ? AND expires_at > datetime('now')`).bind(state).first<{ state: string; redirectUri: string }>();
    if (!stateRow) return new Response('Expired OAuth state', { status: 400 });
    await this.db.prepare('DELETE FROM oauth_states WHERE state = ?').bind(state).run();
    if (!this.isConfigured()) return new Response('GitHub OAuth is not configured', { status: 503 });

    const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST', headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_id: this.config.githubClientId, client_secret: this.config.githubClientSecret, code, redirect_uri: stateRow.redirectUri, state }),
    });
    const tokenData = await tokenResponse.json() as { access_token?: string; error?: string };
    if (!tokenResponse.ok || !tokenData.access_token) return new Response('GitHub token exchange failed', { status: 502 });
    const headers = {
      Authorization: `Bearer ${tokenData.access_token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'Project-Espera/1.0',
    };
    const profileResponse = await fetch('https://api.github.com/user', { headers });
    if (!profileResponse.ok) return new Response('GitHub profile lookup failed', { status: 502 });
    const profile = await profileResponse.json() as { id: number; login: string; name?: string; email?: string | null; avatar_url?: string };
    let email = profile.email || null;
    if (!email) {
      const emailsResponse = await fetch('https://api.github.com/user/emails', { headers });
      if (emailsResponse.ok) {
        const emails = await emailsResponse.json() as Array<{ email: string; primary: boolean; verified: boolean }>;
        email = emails.find((item) => item.primary && item.verified)?.email || emails.find((item) => item.verified)?.email || null;
      }
    }
    const userId = `user_github_${profile.id}`;
    await this.db.prepare(`
      INSERT INTO users (id, name, email, auth_provider, provider_subject, avatar_url)
      VALUES (?, ?, ?, 'github', ?, ?)
      ON CONFLICT(id) DO UPDATE SET name = excluded.name, email = excluded.email, avatar_url = excluded.avatar_url, updated_at = datetime('now')
    `).bind(userId, profile.name || profile.login, email, String(profile.id), profile.avatar_url || null).run();
    const rawSession = randomToken();
    await this.db.prepare(`INSERT INTO sessions (id, user_id, token_hash, expires_at) VALUES (?, ?, ?, datetime('now', '+30 days'))`).bind(`session_${crypto.randomUUID()}`, userId, await sha256(rawSession)).run();
    return new Response(null, { status: 302, headers: { Location: `${this.config.frontendOrigin || new URL(request.url).origin}/`, 'Set-Cookie': cookie('espera_session', rawSession, { maxAge: 60 * 60 * 24 * 30, sameSite: 'None' }) } });
  }

  async logout(request: Request): Promise<Response> {
    const raw = cookieValue(request.headers.get('Cookie') || undefined, 'espera_session');
    if (raw) await this.db.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(await sha256(raw)).run();
    return Response.json({ ok: true }, { headers: { 'Set-Cookie': cookie('espera_session', '', { maxAge: 0 }) } });
  }

  async me(request: Request): Promise<Response> {
    const user = await this.currentUser(request);
    return Response.json({ authenticated: Boolean(user), required: this.mode === 'required', configured: this.isConfigured(), user });
  }
}
