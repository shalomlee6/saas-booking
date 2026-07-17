/**
 * Production: leave `apiUrl` empty when the app is served from the same origin as `/api`.
 * Set to `https://your-api.example.com` (host only) OR `https://your-api.example.com/api`
 * if your gateway already exposes routes under `/api`. Do not set `.../api` and rely on
 * same-origin `/api` — use empty string instead.
 */
export const environment = {
  production: true,
  useMocks: false,
  mockPublicApi: false,
  apiUrl: '',
  adminDomain: 'boki.co.il',
};
