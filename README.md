# saas-booking

Booking SaaS for small businesses (Hebrew/RTL first). npm workspaces + Turborepo.

| Path | What it is |
| --- | --- |
| `apps/api` | Express + MongoDB API (`/api/...`) |
| `apps/frontend-web` | Angular app: owner portal and the public client site (`/b/:slug`) |
| `scripts/` | Repo-level runners (`dev-prodlike`, `seed-prodlike`, `e2e-real-api`) |

Local ports: API `3000` and web `4200` (normal dev), web `4201` (mock e2e), API `3100` and web `4300` (`dev:prodlike`).

## Development

```bash
npm install
npm run dev                  # turbo: API (tsx watch) + Angular dev server with proxy.conf.json
npm run start:mock -w frontend-web   # Angular only, no backend (mock API interceptor)
```

Copy `.env.example` to `apps/api/.env` when you want to override the development defaults.

## Production-like local run

Test what production will do before deploying: the real API in `NODE_ENV=production`, and the
production Angular build, wired together, with no mock interceptor.

```bash
npm run dev:prodlike         # API http://localhost:3100  +  web http://localhost:4300
npm run seed:prodlike        # reset the prod-like database to known fixtures (optional, see below)
npm run e2e:real-api         # Playwright project "real-api" against dev:prodlike
```

**Prerequisite:** a local MongoDB running as a **replica set** (production creates appointments inside a
transaction and refuses to run without one: `503 TXN_REQUIRED`). `dev:prodlike` checks this and stops
with a message if it is a standalone `mongod`. Single-node setup, once:

```bash
mongod --replSet rs0 --dbpath <some-folder>
mongosh --eval "rs.initiate()"
```

`dev:prodlike` uses its **own database**, `saas-booking-prodlike` (override with `PRODLIKE_MONGO_URI`).
It never uses your development database, and `seed:prodlike` refuses any other database name or any
non-local host.

What it runs:

* **API:** `npm run build -w @saas-booking/api`, then `node dist/index.js` with the production values in
  `scripts/prodlike-config.mjs`: `NODE_ENV=production`, `IDENTITY_MODE=phone`, production rate limits,
  `TRUST_PROXY` (production default: 1), production CORS handling, required-variable validation,
  required Mongo transactions, `ALLOW_PUBLIC_REGISTER` gated, `/api/admin/test-seed` disabled.
* **Web:** `ng serve --configuration=production` (optimized, hashed bundle, `environment.prod.ts`,
  `useMocks: false`, `mockPublicApi: false`), with `/api` and `/uploads` proxied to the API
  (`apps/frontend-web/proxy.prodlike.conf.json`), the way a production gateway serves both from one origin.

The two things that stay dev-safe, both switched by `PRODLIKE_LOCAL=true`:

1. **Secure cookies** are off (they cannot be stored over plain `http://localhost`).
2. **SMS** uses the log provider instead of the real gateway (phone mode sends no SMS anyway).

The API honors `PRODLIKE_LOCAL` only when `NODE_ENV=production` **and** `MONGO_URI`, `BASE_URL` and every
`CLIENT_ORIGIN` are local hosts. On a real deployment the flag does nothing, and the API refuses to
start if it is set next to a non-local URL (`apps/api/src/config/env.ts`, covered by
`prodlikeLocal.test.ts`).

### The `real-api` Playwright project

`npm run e2e:real-api` starts `dev:prodlike` itself (set `PLAYWRIGHT_REUSE_SERVER=1` to reuse one that is
already running), waits for `/api/ready`, resets `saas-booking-prodlike` to fixtures
(business `prodlike-salon`, known customer `0501111111`), then runs `apps/frontend-web/e2e/real-api/`:

* it really is phone mode, and the session cookie is `HttpOnly; SameSite=Lax` (no `Secure`, by design)
* book → home card and "התורים שלי" show it, no name shown
* another device with the same phone sees nothing
* reschedule from the home card, cancel
* log out → business home page `/b/:slug`, no client state left, session gone

The project only exists when `REAL_API_E2E=true` (the npm script sets it), so the normal Playwright run
never needs a database.

## Environment differences: development vs production

| Area | Development | Production | `dev:prodlike` |
| --- | --- | --- | --- |
| `NODE_ENV` | unset / `development` | `production` | `production` |
| Required variables | defaults + warnings | fail fast: `PORT`, `MONGO_URI`, `JWT_SECRET` (32+ chars), `BASE_URL` | production rules, local values |
| `IDENTITY_MODE` default | `otp` | `phone` | `phone` (explicit) |
| SMS provider | log provider (prints the code) | TextMe (not configured yet; `otp` mode cannot send) | log provider (`PRODLIKE_LOCAL`) |
| Cookies `Secure` (`sb_token`, `sb_public_customer`) | off | on | **off** (`PRODLIKE_LOCAL`) |
| CORS (`CLIENT_ORIGIN`) | default `http://localhost:4200` | your web origin(s) | `http://localhost:4300`, `http://127.0.0.1:4300` |
| `BASE_URL` | default `http://localhost:4200` | required public URL | `http://localhost:4300` |
| Rate limits | window 60 s; max sensitive/otp/otp-verify/otp-ip/public/api/admin = 100/50/50/200/2000/5000/2000 | window 15 min; 10/5/5/20/100/300/100 | production values |
| Identify limits in `phone` mode (per phone / per IP, same window as OTP) | 10 / 200 | 10 / 200 | 10 / 200 |
| `TRUST_PROXY` | `false` | `1` hop | production default |
| MongoDB down at start | keeps running without a DB | exits after 5 attempts | exits |
| Mongo transactions | standalone is fine (non-atomic fallback) | required (`503 TXN_REQUIRED`) | required (replica set) |
| `ALLOW_PUBLIC_REGISTER` | allowed unless `false` | only when `true` | gated |
| `POST /api/admin/test-seed` | on when `E2E_TEST_SEED_SECRET` is set | `404` | `404` |
| Password-reset email | not required | `SENDGRID_API_KEY` + `FROM_EMAIL` required | not configured |
| `seed:dev` and other data scripts | allowed (local Mongo only) | refuse to run | n/a (`seed:prodlike` is its own script) |
| Angular configuration | `development`: unoptimized, source maps, `apiUrl: ''` proxied to `:3000` | `production`: optimized, hashed, budgets (1 MB warn / 1.5 MB error), `apiUrl: ''` same origin, `adminDomain: boki.co.il` | `production` |
| Mock API | `mock` configuration only (`useMocks`, `mockPublicApi`) | never | never |
| Tenant by hostname | `localhost` / `127.0.0.1` use `/b/:slug` | a non-admin hostname's first label is the slug | `localhost` |

`GA_ID` and `STRIPE_KEY` are optional and currently unused in both.

### Which tests use the mock API

| Suite | Backend |
| --- | --- |
| API Jest (`apps/api`) | real Express app, in-memory **standalone** MongoDB, `NODE_ENV=test` |
| Frontend unit (`ng test`) | stubbed services |
| Playwright `chromium` project: `accessibility`, `public-a11y`, `public-identity`, `layout-nav`, `super-admin`, and the `*.screenshots` specs | **mock server** (`ng serve --configuration=mock`, port 4201): no API, no database |
| Playwright with `USE_REAL_API=true` (older mode) | dev API + dev web build, seeded through `/api/admin/test-seed` |
| Playwright `real-api` project | **real API in production mode** via `dev:prodlike` |

The mock suites cannot catch anything that depends on the real API: cookies, sessions, transactions,
rate limits, CORS, or production-only code paths. That is what `real-api` is for.

## Pre-deploy checklist

Run from the repo root unless noted.

1. **Lint:** `npm run lint`
2. **Type-check:** `npm run check` (turbo: lint, `typeCheck`, tests) or per app: `npx tsc --noEmit` in
   `apps/api`; `npx tsc -p tsconfig.app.json --noEmit` and `npx tsc -p tsconfig.spec.json --noEmit` in `apps/frontend-web`
3. **API tests:** `npm test -w @saas-booking/api`
4. **Frontend unit tests:** `npm test -w frontend-web`
5. **Mock e2e, both identity modes** (in `apps/frontend-web`):
   ```bash
   npx playwright test e2e/accessibility.spec.ts e2e/public-identity.spec.ts e2e/public-a11y.spec.ts
   IDENTITY_MODE=phone npx playwright test e2e/public-identity.spec.ts e2e/public-a11y.spec.ts
   ```
   (PowerShell: `$env:IDENTITY_MODE='phone'; npx playwright test ...`.) Specs that need a one-time code skip in phone mode.
6. **Production build:** `npm run build` (watch the initial-bundle budget warning)
7. **Real-API e2e:** `npm run e2e:real-api`
8. **Deploy environment:** `NODE_ENV=production`, `PORT`, `MONGO_URI` (replica set), `JWT_SECRET` (32+),
   `BASE_URL`, `CLIENT_ORIGIN`, `IDENTITY_MODE=phone`, `TRUST_PROXY` matching your proxy hops,
   `SENDGRID_API_KEY` + `FROM_EMAIL`, optional `SUPER_ADMIN_EMAILS`. Do **not** set `PRODLIKE_LOCAL`.
