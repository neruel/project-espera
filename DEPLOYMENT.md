# Project Espera Deployment

This guide covers local development, checks, and a complete self-hosted deployment on Cloudflare (Workers + D1 for the API, Pages for the client).

## Local

```bash
npm ci
npm run db:migrate:local
npm run dev
```

- Frontend: `http://localhost:5173`
- API: `http://127.0.0.1:8787`

The local server persists its SQLite-compatible database under `packages/server/.data/`, which is ignored by Git. Use the Mock Provider for a no-key smoke test. In development the client starts login on its own origin (the Vite `/api` proxy), so `VITE_AUTH_ORIGIN` is not needed.

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

## Self-hosting on Cloudflare

### Architecture

```text
Browser ──▶ Cloudflare Pages (client + functions/api/[[path]].ts proxy)
                 │  /api/* forwarded to ESPERA_API_ORIGIN
                 ▼
           Cloudflare Worker (Hono API, packages/server)
                 │
                 ▼
           Cloudflare D1 (SQLite)
```

The browser calls `/api/*` on its own Pages origin. The Pages Function forwards those requests to the Worker so session cookies stay first-party on mobile browsers. Only the GitHub OAuth start and callback run directly on the Worker origin.

In the steps below, replace:

- `<worker>` with your Worker host, for example `project-espera-api.<your-subdomain>.workers.dev`
- `<pages>` with your Pages host, for example `my-espera.pages.dev`

### 1. Prerequisites

- Node.js 20 or later and npm 10 or later
- A Cloudflare account with Workers, D1, and Pages enabled
- A GitHub account for the OAuth App
- `openssl` (or another way to generate 32 random bytes as Base64)

```bash
npm ci
npx wrangler login
npx wrangler whoami
```

Wrangler is installed as a dev dependency of `packages/server`, so `npx wrangler` works from the repository root and from `packages/server`.

### 2. Create the D1 database

```bash
cd packages/server
npx wrangler d1 create project-espera-db
```

Copy the `database_id` from the output and replace the existing value in `packages/server/wrangler.toml`:

```toml
[[d1_databases]]
binding = "DB"
database_name = "project-espera-db"
database_id = "<your-database-id>"
migrations_dir = "migrations"
```

Keep `binding = "DB"`; the Worker reads the database from that binding. If you pick another database name, use it consistently in `database_name` and in the migration command below.

### 3. Apply migrations

From `packages/server`:

```bash
npx wrangler d1 migrations apply project-espera-db --remote
```

This applies every file in `packages/server/migrations/` (currently `0001` through `0005`) in order. Re-run it whenever new migrations are added, before deploying the Worker.

### 4. Configure `wrangler.toml`

Edit the `[vars]` section of `packages/server/wrangler.toml`:

| Variable | Value |
| --- | --- |
| `ESPERA_ALLOWED_ORIGIN` | `https://<pages>` (write requests with an `Origin` header must match it) |
| `ESPERA_FRONTEND_ORIGIN` | `https://<pages>` (where the OAuth callback redirects after login) |
| `GITHUB_OAUTH_REDIRECT_URI` | `https://<worker>/api/auth/github/callback` |
| `ESPERA_ALLOWED_ENDPOINT_HOSTS` | Comma-separated hosts of OpenAI-compatible APIs your users may call |
| `ESPERA_AUTH_MODE` | Keep `required` |
| `ESPERA_ENDPOINT_POLICY` | Keep `allowlisted-https` |

You can also rename the Worker with `name` at the top of the file; the Worker host becomes `<name>.<your-subdomain>.workers.dev`.

With `allowlisted-https`, the Worker accepts official provider endpoints plus the exact hosts in `ESPERA_ALLOWED_ENDPOINT_HOSTS`, over HTTPS on port 443 only, and rejects other hosts and IP literals. Add a host only after reviewing who controls its DNS and where requests and API keys will go; use a separate egress control before enabling arbitrary hosts.

### 5. Create a GitHub OAuth App

In GitHub, open Settings → Developer settings → OAuth Apps → New OAuth App:

- Homepage URL: `https://<pages>`
- Authorization callback URL: `https://<worker>/api/auth/github/callback`

The callback must match `GITHUB_OAUTH_REDIRECT_URI` exactly. The Worker requests the `read:user user:email` scopes. After creating the app, copy the Client ID and generate a Client Secret.

### 6. Set Worker secrets

From `packages/server`:

```bash
npx wrangler secret put GITHUB_CLIENT_ID
npx wrangler secret put GITHUB_CLIENT_SECRET
npx wrangler secret put ESPERA_MASTER_ENCRYPTION_KEY
```

`ESPERA_MASTER_ENCRYPTION_KEY` is a standard Base64-encoded raw AES-GCM key. Generate a 32-byte key with:

```bash
openssl rand -base64 32
```

This key encrypts API keys that users choose to remember in their account. Store it separately: if it is lost or changed, previously saved keys cannot be decrypted and users must re-enter them. Never commit secrets or place them in `wrangler.toml`.

### 7. Deploy the Worker

From `packages/server`:

```bash
npx wrangler deploy
```

Verify that `https://<worker>/api/auth/me` responds and reports that authentication is required.

### 8. Create the Pages project

From the repository root:

```bash
npx wrangler pages project create <pages-project-name> --production-branch main
```

The default Pages host is `<pages-project-name>.pages.dev`. It must match the origins you set in step 4 and the OAuth App homepage in step 5.

### 9. Set the Pages API origin

The Pages Function forwards `/api/*` to `ESPERA_API_ORIGIN`, falling back to the hosted demo Worker when unset. Set it to your Worker origin (HTTPS, no path), either in the Cloudflare dashboard under the Pages project's Settings → Variables and Secrets, or with Wrangler:

```bash
npx wrangler pages secret put ESPERA_API_ORIGIN --project-name <pages-project-name>
# value: https://<worker>
```

### 10. Build and deploy the client

Production builds start GitHub login on `VITE_AUTH_ORIGIN`, which defaults to the hosted demo Worker. Set it to your Worker origin at build time, then deploy from the repository root so Wrangler includes `functions/`:

```bash
VITE_AUTH_ORIGIN=https://<worker> npm run build
npx wrangler pages deploy packages/client/dist --project-name <pages-project-name>
```

(`VAR=value command` is POSIX shell syntax; in PowerShell use `$env:VITE_AUTH_ORIGIN="https://<worker>"; npm run build`.)

Open `https://<pages>`, sign in with GitHub, and add a provider connection in Settings → Connections.

### Updating an existing deployment

```bash
cd packages/server
npx wrangler d1 migrations apply project-espera-db --remote
npx wrangler deploy
cd ../..
VITE_AUTH_ORIGIN=https://<worker> npm run build
npx wrangler pages deploy packages/client/dist --project-name <pages-project-name>
```

## How login works

OAuth starts directly on the Worker so its state cookie returns to the registered callback. The Worker redirects to Pages with a short-lived, single-use handoff in the URL fragment; the frontend removes it immediately and exchanges it through the same-origin Pages proxy. The session cookie is then set on the Pages origin. Production requires GitHub OAuth and fails closed when `ESPERA_AUTH_MODE` is not set.

## Hosted demo deployment

- API Worker: `https://project-espera-api.hfainvididual.workers.dev`
- Frontend: `https://project-espera-web.pages.dev` (Pages project `project-espera-web`)
- D1 database: `project-espera-db`
- OAuth callback: `https://project-espera-api.hfainvididual.workers.dev/api/auth/github/callback`

## Credential lifecycle

Provider API keys stay in browser memory by default and must not be written unencrypted to D1, Web Storage, URLs, logs, context runs, Git, or Cloudflare project configuration. If a user explicitly chooses Remember key, the Worker encrypts the key with AES-GCM before storing ciphertext in D1.

`.env`, `.dev.vars`, local database files, private keys, and Wrangler state are excluded by `.gitignore`. Only placeholder values belong in `.env.example`.
