/**
 * Production build — replace `apiUrl` with your deployed API origin if the
 * Angular app is not served from the same host as the API (e.g. CDN frontend).
 */
export const environment = {
  production: true,
  useMocks: false,
  mockPublicApi: false,
  apiUrl: 'https://api.your-domain.com',
};
