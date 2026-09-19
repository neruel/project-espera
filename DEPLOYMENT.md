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
```

## Cloudflare

Before deployment, confirm the authenticated account and inspect the existing configuration:

```bash
npx wrangler whoami
npx wrangler d1 list
```

Use only the dedicated `project-espera-db` database configured in `packages/server/wrangler.toml`. Apply migrations with `npx wrangler d1 migrations apply <database-name> --remote`, then deploy the Worker with `npx wrangler deploy`.

The current Worker has a single default user and is not suitable for a public multi-user deployment without an authentication layer. Configure an explicit production CORS origin before exposing it.

## Current deployment

- API Worker: `https://project-espera-api.hfainvididual.workers.dev`
- Frontend: `https://project-espera-web.pages.dev`
- D1 database: `project-espera-db`
- Verified Worker version: `c7e4ec1f-a44f-49f0-8cf4-62b9a008465a`

## Credential lifecycle

Provider API keys are session-only BYOK values. They must not be placed in D1, Web Storage, URLs, logs, context runs, Git, or Cloudflare project configuration.
