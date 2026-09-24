# Project Espera — Current State

Updated: 2026-09-24

## Product boundary

Espera is a provider-independent persistence layer for persona, user-controlled memory, conversations, and project context. Its production Worker requires a GitHub OAuth session and scopes stored data by authenticated user.

## Implemented

- React/Vite client, Hono API Worker, local SQLite-compatible adapter, and sequential D1 migrations.
- Conversations, persona revisions, memory review and history, context inspection, projects, and provider connections.
- GitHub OAuth sessions with hashed tokens, `HttpOnly`, `Secure`, `SameSite=Lax` host-only cookies.
- Pages same-origin `/api/*` proxy and one-time OAuth handoff so mobile browsers do not need third-party cookies; the existing Worker OAuth callback remains valid.
- BYOK keys are tab-memory only unless the user opts into AES-GCM encrypted D1 storage.
- Users can delete their account and all account-owned data from the account menu.
- Production Worker configuration requires authentication, restricts write origins, disables API caching, and permits official endpoints and a curated list of OpenAI-compatible API hosts over HTTPS.
- `.gitignore` excludes environment files, Wrangler state, local databases, and private key files.

## Beta deployment

- D1 migration `0005_oauth_handoffs.sql` is applied to `project-espera-db`.
- Worker `project-espera-api` runs `1.0.0-beta.3`; Pages project `project-espera-web` retains the `1.0.0-beta.2` client build because this update changes only the Worker allowlist.
- Pages forwards same-origin `/api/*` requests to the Worker; production `/api/auth/me` confirms auth is required and GitHub OAuth is configured.
- Production smoke checks pass for health, CORS, and the unauthenticated API boundary.
- The production endpoint policy is `allowlisted-https`: official APIs and configured OpenAI-compatible hosts, including FactChat at `factchat-cloud.mindlogic.ai`, are available over HTTPS/443. Other custom hosts require operator review and configuration.

See [DEPLOYMENT.md](./DEPLOYMENT.md) for deployment steps and [THREAT_MODEL.md](./THREAT_MODEL.md) for the security boundaries.
