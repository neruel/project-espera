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

Create or reuse only a dedicated Espera D1 database. Do not replace the placeholder `database_id` in `packages/server/wrangler.toml` until the target database is confirmed. Apply migrations with `npx wrangler d1 migrations apply <database-name> --remote`, then deploy the Worker with `npx wrangler deploy`.

The current Worker has a single default user and is not suitable for a public multi-user deployment without an authentication layer. Configure an explicit production CORS origin before exposing it.

## Credential lifecycle

Provider API keys are session-only BYOK values. They must not be placed in D1, Web Storage, URLs, logs, context runs, Git, or Cloudflare project configuration.
