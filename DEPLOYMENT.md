# Project Espera Deployment

## Local

```bash
npm ci
npm run db:migrate:local
npm run dev
```

The local server persists its SQLite-compatible database under `packages/server/.data/`, which is ignored by Git. Use the Mock Provider for a no-key smoke test.

## Checks

```bash
npm audit
npm run lint
npm run typecheck
npm test
npm run build

npm run test:e2e

# Production smoke test (uses Mock Provider and cleans up temporary metadata)
ESPERA_API_URL=https://project-espera-api.hfainvididual.workers.dev npm run test:production
```

## Cloudflare

Before deployment, confirm the authenticated account and inspect the existing configuration:

```bash
npx wrangler whoami
npx wrangler d1 list
```

Use only the dedicated `project-espera-db` database configured in `packages/server/wrangler.toml`. Apply migrations with `npx wrangler d1 migrations apply project-espera-db --remote`, then deploy the Worker from `packages/server` with `npx wrangler deploy`.

Production requires GitHub OAuth and fails closed when `ESPERA_AUTH_MODE` is not set. Browser write requests with an `Origin` header must match the configured Pages origin. Production Provider endpoints are restricted to official OpenAI, Anthropic, and Google hosts to reduce SSRF risk.

The browser calls `/api/*` on its own Pages origin. The Pages Function in `functions/api/[[path]].ts` forwards those requests to the Worker so session cookies remain first-party on mobile browsers. Deploy Pages from the repository root so Wrangler includes `functions/`:

```bash
npm run build
npx wrangler pages deploy packages/client/dist --project-name project-espera-web
```

If the API Worker URL changes, update `DEFAULT_API_ORIGIN` in the Pages Function or set the Pages runtime variable `ESPERA_API_ORIGIN` to its HTTPS origin.

The GitHub OAuth App callback remains on the Worker origin. OAuth starts directly on the Worker so its state cookie returns to the registered callback. The Worker redirects to Pages with a short-lived, single-use handoff in the URL fragment; the frontend removes it immediately and exchanges it through the same-origin Pages proxy. The session cookie is then set on Pages.

Keep the GitHub OAuth App callback URL set to:

```text
https://project-espera-api.hfainvididual.workers.dev/api/auth/github/callback
```

Apply D1 migrations before deploying the Worker so migration `0005_oauth_handoffs.sql` is present.

## Current deployment

- API Worker: `https://project-espera-api.hfainvididual.workers.dev`
- Frontend: `https://project-espera-web.pages.dev`
- D1 database: `project-espera-db`
- OAuth callback: `https://project-espera-api.hfainvididual.workers.dev/api/auth/github/callback`

## Credential lifecycle

Provider API keys stay in browser memory by default and must not be written unencrypted to D1, Web Storage, URLs, logs, context runs, Git, or Cloudflare project configuration. If a user explicitly chooses Remember key, the Worker encrypts the key with AES-GCM before storing ciphertext in D1.

`.env`, `.dev.vars`, local database files, private keys, and Wrangler state are excluded by `.gitignore`. Only placeholder values belong in `.env.example`.
