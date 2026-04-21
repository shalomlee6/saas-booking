/**
 * Production: leave `apiUrl` empty when the app is served from the same origin as `/api`.
 * Set to `https://your-api.example.com` when the API is on another host (no trailing slash).
 */
export const environment = {
  production: true,
  useMocks: false,
  mockPublicApi: false,
  apiUrl: '',
};
