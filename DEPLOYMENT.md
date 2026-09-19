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

Use only the dedicated `project-espera-db` database configured in `packages/server/wrangler.toml`. Apply migrations with `npx wrangler d1 migrations apply <database-name> --remote`, then deploy the Worker with `npx wrangler deploy`.

The current Worker has a single default user and is not suitable for a public multi-user deployment without an authentication layer. Production CORS is pinned to the Pages origin in `wrangler.toml`.

## Current deployment

- API Worker: `https://project-espera-api.hfainvididual.workers.dev`
- Frontend: `https://project-espera-web.pages.dev`
- D1 database: `project-espera-db`
- Verified Worker version: `46e6f5af-14d3-4c26-9efc-03d786953527`
- Wrangler: `4.135.0`

## Credential lifecycle

Provider API keys are session-only BYOK values. They must not be placed in D1, Web Storage, URLs, logs, context runs, Git, or Cloudflare project configuration.
