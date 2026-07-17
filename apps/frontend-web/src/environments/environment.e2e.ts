/**
 * E2E against a local API (Playwright `USE_REAL_API=true`).
 * Ensure CLIENT_ORIGIN on the API includes this UI origin (e.g. http://127.0.0.1:4201).
 */
export const environment = {
  production: false,
  useMocks: false,
  mockPublicApi: false,
  apiUrl: 'http://127.0.0.1:3000',
  // Playwright serves the UI on 127.0.0.1:4201 (see playwright.config.ts); DomainTenantService
  // already treats 127.0.0.1 as localhost, but keep this in sync with the served host.
  adminDomain: '127.0.0.1',
};
