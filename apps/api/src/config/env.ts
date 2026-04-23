import fs from 'fs';
import path from 'path';
import { z } from 'zod';

const DEFAULT_DEV_PORT = 3000;
const DEFAULT_DEV_BASE_URL = 'http://localhost:4200';
const DEFAULT_DEV_MONGO = 'mongodb://127.0.0.1:27017/saas-booking';
const DEFAULT_DEV_JWT = 'dev-only-insecure-jwt-secret-min-32-chars!!';

const productionSchema = z
  .object({
    NODE_ENV: z.literal('production'),
    PORT: z.coerce.number().int().positive(),
    MONGO_URI: z.string().min(1, 'MONGO_URI is required'),
    JWT_SECRET: z.string().min(1, 'JWT_SECRET is required'),
    BASE_URL: z.string().min(1, 'BASE_URL is required').url('BASE_URL must be a valid URL'),
    GA_ID: z
      .string()
      .optional()
      .transform((v) => (v && v.trim() !== '' ? v : undefined)),
    STRIPE_KEY: z
      .string()
      .optional()
      .transform((v) => (v && v.trim() !== '' ? v : undefined)),
  })
  .superRefine((data, ctx) => {
    if (data.JWT_SECRET.length < 32) {
      ctx.addIssue({
        code: 'custom',
        path: ['JWT_SECRET'],
        message: 'JWT_SECRET must be at least 32 characters in production',
      });
    }
  });

export type Env = {
  NODE_ENV: 'development' | 'production' | 'test';
  PORT: number;
  MONGO_URI: string;
  JWT_SECRET: string;
  BASE_URL: string;
  GA_ID?: string;
  STRIPE_KEY?: string;
};

let cached: Env | null = null;

function envPath(): string {
  return path.join(process.cwd(), '.env');
}

function envFileExists(): boolean {
  try {
    return fs.existsSync(envPath());
  } catch {
    return false;
  }
}

function normalizeOptionalString(v: string | undefined): string | undefined {
  if (v === undefined || v.trim() === '') return undefined;
  return v;
}

function parsePort(raw: string | undefined, fallback: number): number {
  if (raw === undefined || raw.trim() === '') return fallback;
  const n = Number(raw);
  if (!Number.isInteger(n) || n <= 0) {
    console.warn(`⚠️ Invalid PORT "${raw}" — using ${fallback} for local development.`);
    return fallback;
  }
  return n;
}

function parseBaseUrl(raw: string | undefined, fallback: string): string {
  const s = raw !== undefined && raw.trim() !== '' ? raw.trim() : fallback;
  const ok = z.string().url().safeParse(s);
  if (!ok.success) {
    console.warn(`⚠️ Invalid BASE_URL "${raw ?? ''}" — using ${fallback} for local development.`);
    return fallback;
  }
  return ok.data;
}

/**
 * Resolves and validates environment.
 * - Production: fail fast on invalid or missing required variables.
 * - Development / test: apply safe defaults, warn (no exit for missing .env).
 */
export function validateEnv(): Env {
  if (cached) {
    return cached;
  }

  const nodeEnvRaw = process.env.NODE_ENV;
  const isProduction = nodeEnvRaw === 'production';

  if (isProduction) {
    const result = productionSchema.safeParse(process.env);
    if (!result.success) {
      console.error('❌ Invalid or missing environment variables (production):');
      for (const issue of result.error.issues) {
        const p = issue.path.length ? issue.path.join('.') : '(root)';
        console.error(`   • ${p}: ${issue.message}`);
      }
      process.exit(1);
    }
    cached = {
      NODE_ENV: 'production',
      PORT: result.data.PORT,
      MONGO_URI: result.data.MONGO_URI,
      JWT_SECRET: result.data.JWT_SECRET,
      BASE_URL: result.data.BASE_URL,
      GA_ID: result.data.GA_ID,
      STRIPE_KEY: result.data.STRIPE_KEY,
    };
    return cached;
  }

  if (!envFileExists()) {
    console.warn(
      `⚠️ No .env file at ${envPath()} — using development defaults. Copy .env.example when ready.`
    );
  }

  const NODE_ENV: Env['NODE_ENV'] =
    nodeEnvRaw === 'test' ? 'test' : nodeEnvRaw === 'development' || !nodeEnvRaw ? 'development' : 'development';

  if (nodeEnvRaw && nodeEnvRaw !== 'development' && nodeEnvRaw !== 'test') {
    console.warn(`⚠️ Unrecognized NODE_ENV="${nodeEnvRaw}" — treating as development for startup.`);
  }

  const PORT = parsePort(process.env.PORT, DEFAULT_DEV_PORT);
  if (process.env.PORT === undefined || process.env.PORT.trim() === '') {
    console.warn(`⚠️ PORT not set — using ${DEFAULT_DEV_PORT} for local development.`);
  }

  const BASE_URL = parseBaseUrl(process.env.BASE_URL, DEFAULT_DEV_BASE_URL);
  if (process.env.BASE_URL === undefined || process.env.BASE_URL.trim() === '') {
    console.warn(`⚠️ BASE_URL not set — using ${DEFAULT_DEV_BASE_URL} for local development.`);
  }

  let MONGO_URI =
    process.env.MONGO_URI !== undefined && process.env.MONGO_URI.trim() !== ''
      ? process.env.MONGO_URI.trim()
      : DEFAULT_DEV_MONGO;
  if (process.env.MONGO_URI === undefined || process.env.MONGO_URI.trim() === '') {
    console.warn(`⚠️ MONGO_URI not set — using default ${DEFAULT_DEV_MONGO}`);
  }

  let JWT_SECRET =
    process.env.JWT_SECRET !== undefined && process.env.JWT_SECRET.trim() !== ''
      ? process.env.JWT_SECRET.trim()
      : DEFAULT_DEV_JWT;
  if (process.env.JWT_SECRET === undefined || process.env.JWT_SECRET.trim() === '') {
    console.warn('⚠️ JWT_SECRET not set — using insecure development default. Set JWT_SECRET before any real data.');
  }

  if (JWT_SECRET.length < 32) {
    console.warn(
      '⚠️ JWT_SECRET is shorter than 32 characters — acceptable only in development; use a strong secret in production.'
    );
  }

  const GA_ID = normalizeOptionalString(process.env.GA_ID);
  const STRIPE_KEY = normalizeOptionalString(process.env.STRIPE_KEY);

  cached = {
    NODE_ENV,
    PORT,
    MONGO_URI,
    JWT_SECRET,
    BASE_URL,
    GA_ID,
    STRIPE_KEY,
  };
  return cached;
}
