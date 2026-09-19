# Project Espera — Current State

Updated: 2026-09-19

## Product boundary

Espera is a provider-independent persistence layer for persona, user-controlled memory, conversations, and project context. The current implementation uses a single local default user and is therefore suitable for a personal MVP, not yet a multi-user SaaS deployment.

## Implemented and verified

- React/Vite client and Hono server workspace.
- SQLite-compatible local adapter and sequential D1 migrations.
- Conversations and messages persisted through repositories.
- Persona editing with versioned revisions.
- Memory candidates, evidence, revisions, approval, rejection, soft delete, and hard delete.
- Context composition from persona, active memories, and recent messages.
- Context Inspector with persisted context runs.
- Mock, OpenAI, Anthropic, Gemini, and OpenAI-compatible provider adapters.
- Session-only BYOK credential transport; credentials are not written to D1 or Web Storage.
- Model discovery and manual model selection UI.
- Baseline `npm ci`, lint, typecheck, tests, and production build pass.

## Known gaps

- Provider connection metadata and model catalogs are persisted in D1; API keys remain session-only.
- Authentication is intentionally a single local default user. A production deployment needs an explicit auth boundary before exposing private data publicly.
- Projects are represented in the schema but do not yet have a complete UI/API workflow.
- Conversation retry/cancel UX and automated browser E2E coverage are incomplete.
- A dedicated `project-espera-db` D1 has been created, wired into `packages/server/wrangler.toml`, migrated, and used by the deployed Worker.
- CORS currently permits all origins for local development; production must set an explicit frontend origin.
- DNS rebinding protection for arbitrary custom hosts cannot be fully enforced by the current Worker-only URL parser; production should prefer official endpoints or an explicit allowlist.
- Wrangler 3 is installed locally while Wrangler 4 is available; upgrading is a separate compatibility change.

## Security findings addressed in this pass

- Anthropic requests now use the common endpoint validation, manual redirect blocking, and redacted provider error path.
- Generic application errors no longer return raw exception messages to clients.
- `.gitignore` excludes environment files, local databases, Wrangler state, logs, and build output.

## Priority order

1. Add explicit production auth and origin configuration.
2. Add Project API/UI and browser-level smoke tests.
3. Add retry/cancel UX and browser-level E2E coverage.
4. Upgrade Wrangler 3 to Wrangler 4 in a compatibility-tested change.

## Deployment verified

- API Worker: `project-espera-api` at `https://project-espera-api.hfainvididual.workers.dev`
- Frontend Pages project: `project-espera-web` at `https://project-espera-web.pages.dev`
- D1: `project-espera-db` (migrations 0001, 0002, and 0003 applied)
- Production smoke path: health → providers → persona → conversation → Mock chat → pending memory → frontend load
- Provider persistence smoke path: create metadata → reload from D1 → verify credential redaction → delete
