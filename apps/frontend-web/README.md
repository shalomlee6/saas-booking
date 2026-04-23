# frontend-web

## Overview

Angular **20** SPA for the **saas-booking** product: back-office and public booking flows. The UI uses **standalone components** only, **lazy-loaded** feature routes, **NgRx** (store, effects, entity) for shared state, and **PrimeNG** with the **Aura** theme (`providePrimeNG` in `app.config.ts`). HTTP is centralized in **services** (e.g. `ApiService`); components should not inject `HttpClient` directly.

## Prerequisites

- **Node.js** ≥ 20  
- **npm** ≥ 11 (repo pins `packageManager` in the monorepo root)  
- Clone the **saas-booking** monorepo and install dependencies from the **repository root**:

  ```bash
  cd saas-booking
  npm install
  ```

Day-to-day commands below assume either the repo root with the workspace flag, or `apps/frontend-web` as the current directory.

## Running locally

From **`apps/frontend-web`** (after root `npm install`):

| Mode | Command | Notes |
|------|---------|--------|
| **Real API** | `npm run start` | Uses `proxy.conf.json` → API on port 3000. Start **`apps/api`** and configure **`apps/api/.env`** (Mongo, `JWT_SECRET`, etc.). |
| **Mock** | `npm run start:mock` | `environment.mock.ts`: in-memory mock interceptor, **no API or Mongo**. |
| **E2E (manual)** | `npx ng serve --configuration=e2e --host 127.0.0.1 --port 4201` | Same build as Playwright **real-API** runs; usually you run **`npm run e2e`** instead (see below). |

From monorepo root you can run the same via workspace, e.g. `npm run start -w frontend-web`.

## Environment setup

- **Monorepo / shared:** copy the root **`.env.example`** to **`.env`** at the repo root if your tooling or deployment expects it.  
- **API (required for `npm run start` and real-API E2E):** create **`apps/api/.env`** from **`apps/api/.env.example`** and set secrets and `MONGO_URI`, `JWT_SECRET`, `E2E_TEST_SEED_SECRET` (for E2E against a real API), etc.

The Angular app’s `environment.*.ts` files control mock vs real API URLs; they are not loaded from `.env` at build time unless you add extra tooling.

## Playwright E2E

Run from **`apps/frontend-web`**:

| Mode | Command | Requirements |
|------|---------|----------------|
| **Mock (default)** | `npm run e2e` | Playwright starts **`ng serve --configuration=mock`** on **127.0.0.1:4201**. No API or DB. |
| **Real API** | `USE_REAL_API=true npm run e2e` | API on **3000** with health check, Mongo, **`E2E_TEST_SEED_SECRET`** matching API env, and super-admin seed email settings per `playwright.config.ts` / `e2e/global-setup.ts`. UI served with **`--configuration=e2e`**. On Windows PowerShell: `$env:USE_REAL_API='true'; npm run e2e`. |

Optional: `PLAYWRIGHT_REUSE_SERVER=1` to reuse an already-running dev server; `PLAYWRIGHT_SKIP_WEBSERVER=1` if you start servers yourself.

**UI mode:** `npm run e2e:ui`

## Key scripts

| Script | Description |
|--------|-------------|
| `start` | Dev server with **proxy** to real API (`proxy.conf.json`). |
| `start:mock` | Dev server with **mock** HTTP layer (`useMocks` / mock interceptor). |
| `build` | Production build (`ng build`). |
| `typeCheck` | `tsc --noEmit` (TypeScript only; no emit). |
| `test` | Unit tests: **Karma** + **ChromeHeadless**, non-watch. |
| `e2e` | **Playwright** tests (mock stack by default). |
| `e2e:ui` | Playwright with **UI** mode. |

## Architecture (short)

- **Standalone** components; routes load feature areas lazily.  
- **NgRx** for appointments and other shared client state; **services** wrap all backend calls.  
- **PrimeNG** + **Aura** for UI primitives; global styles in `src/styles.scss`.

For API behavior and proxies, see **`apps/api`** and the repo root **`package.json`** / **`turbo.json`**.
