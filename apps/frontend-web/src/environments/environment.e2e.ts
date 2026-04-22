/**
 * E2E against a local API (Playwright `USE_REAL_API=true`).
 * Ensure CLIENT_ORIGIN on the API includes this UI origin (e.g. http://127.0.0.1:4201).
 */
export const environment = {
  production: false,
  useMocks: false,
  mockPublicApi: false,
  apiUrl: 'http://127.0.0.1:3000',
};
