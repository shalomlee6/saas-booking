/** Shared by dev-prodlike.mjs, seed-prodlike.mjs and the real-api Playwright project. */

export const API_PORT = 3100;
export const WEB_PORT = 4300;
export const MONGO_URI = process.env.PRODLIKE_MONGO_URI || 'mongodb://127.0.0.1:27017/saas-booking-prodlike';

/** The production configuration. Anything not listed here keeps its production default. */
export const PRODLIKE_API_ENV = {
  NODE_ENV: 'production',
  PORT: String(API_PORT),
  MONGO_URI,
  // 32+ characters (production requires it). Local only — never reuse this value anywhere real.
  JWT_SECRET: 'prodlike-local-only-jwt-secret-0123456789',
  BASE_URL: `http://localhost:${WEB_PORT}`,
  CLIENT_ORIGIN: `http://localhost:${WEB_PORT},http://127.0.0.1:${WEB_PORT}`,
  IDENTITY_MODE: 'phone',
  // The two dev-safe exceptions. Ignored by the API unless every URL above is local.
  PRODLIKE_LOCAL: 'true',
};
