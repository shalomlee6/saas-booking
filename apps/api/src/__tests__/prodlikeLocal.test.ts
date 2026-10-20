import { cookieSecure, isProdlikeLocal } from '../config/env';
import { publicCustomerCookieOptions } from '../utils/publicCustomerSession';
import { staffAuthCookieOptions } from '../utils/staffSession';
import { LogSmsProvider, TextMeSmsProvider, installSmsProvider } from '../services/smsProvider';

const KEYS = ['NODE_ENV', 'PRODLIKE_LOCAL', 'MONGO_URI', 'BASE_URL', 'CLIENT_ORIGIN'] as const;
const saved: Record<string, string | undefined> = {};

function setEnv(values: Partial<Record<(typeof KEYS)[number], string | undefined>>): void {
  for (const key of KEYS) {
    if (key in values) {
      const value = values[key];
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

const LOCAL = {
  NODE_ENV: 'production',
  PRODLIKE_LOCAL: 'true',
  MONGO_URI: 'mongodb://127.0.0.1:27017/saas-booking-prodlike',
  BASE_URL: 'http://localhost:4300',
  CLIENT_ORIGIN: 'http://localhost:4300,http://127.0.0.1:4300',
} as const;

beforeEach(() => {
  for (const key of KEYS) saved[key] = process.env[key];
});

afterEach(() => {
  for (const key of KEYS) {
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key];
  }
  installSmsProvider(process.env.NODE_ENV ?? 'test');
});

describe('PRODLIKE_LOCAL', () => {
  it('relaxes Secure cookies and the SMS provider only for an all-local production run', () => {
    setEnv(LOCAL);
    expect(isProdlikeLocal()).toBe(true);
    expect(cookieSecure()).toBe(false);
    expect(publicCustomerCookieOptions().secure).toBe(false);
    expect(staffAuthCookieOptions().secure).toBe(false);
    expect(installSmsProvider('production')).toBeInstanceOf(LogSmsProvider);
  });

  it('keeps production behavior when the flag is not set', () => {
    setEnv({ ...LOCAL, PRODLIKE_LOCAL: undefined });
    expect(isProdlikeLocal()).toBe(false);
    expect(cookieSecure()).toBe(true);
    expect(publicCustomerCookieOptions().secure).toBe(true);
    expect(staffAuthCookieOptions().secure).toBe(true);
    expect(installSmsProvider('production')).toBeInstanceOf(TextMeSmsProvider);
  });

  const REMOTE: [string, Partial<Record<(typeof KEYS)[number], string>>][] = [
    ['a remote MongoDB', { MONGO_URI: 'mongodb+srv://user:pw@prod-cluster.example.net/app' }],
    ['a remote BASE_URL', { BASE_URL: 'https://boki.co.il' }],
    ['one remote CLIENT_ORIGIN', { CLIENT_ORIGIN: 'http://localhost:4300,https://boki.co.il' }],
    ['a lookalike host', { MONGO_URI: 'mongodb://user:127.0.0.1@prod.example.net/app' }],
  ];
  for (const [label, override] of REMOTE) {
    it(`does nothing with ${label}`, () => {
      setEnv({ ...LOCAL, ...override });
      expect(isProdlikeLocal()).toBe(false);
      expect(cookieSecure()).toBe(true);
      expect(installSmsProvider('production')).toBeInstanceOf(TextMeSmsProvider);
    });
  }

  it('does nothing outside NODE_ENV=production', () => {
    setEnv({ ...LOCAL, NODE_ENV: 'development' });
    expect(isProdlikeLocal()).toBe(false);
    expect(cookieSecure()).toBe(false);
  });
});
