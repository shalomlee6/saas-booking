import type { BirthdayField, IdentityMode, PublicClientProfile } from './public-identity.rules';

const MOCK_CODE = '482913';
const BLOCKED_PHONE = '0500000000';
const KNOWN_PHONE = '0501111111';
const STORAGE_MODE = 'sb_mock_identity_mode';
const STORAGE_SESSION = 'sb_mock_public_session';

interface MockUpcoming {
  id: string;
  date: string;
  time: string;
  status: string;
  serviceName: string;
  serviceId: string;
  canModify: boolean;
}

interface MockClient {
  slug: string;
  phone: string;
  verified: boolean;
  hasCustomer: boolean;
  firstName?: string;
  birthday?: { day: number; month: number };
  attempts: number;
  dead: boolean;
  /** undefined = not loaded yet; null = the client cancelled it. */
  upcoming?: MockUpcoming | null;
}

const clients = new Map<string, MockClient>();

function digits(phone: string): string {
  const raw = phone.replace(/\D/g, '');
  if (raw.startsWith('972') && raw.length === 12) return `0${raw.slice(3)}`;
  return raw;
}

function readStored(): MockClient | null {
  try {
    const raw = localStorage.getItem(STORAGE_SESSION);
    if (!raw) return null;
    return JSON.parse(raw) as MockClient;
  } catch {
    return null;
  }
}

function persist(client: MockClient | null, slug: string): void {
  try {
    if (!client) {
      const current = readStored();
      if (current?.slug === slug) localStorage.removeItem(STORAGE_SESSION);
      return;
    }
    localStorage.setItem(STORAGE_SESSION, JSON.stringify(client));
  } catch {
    /* ignore */
  }
}

function clientFor(slug: string): MockClient | null {
  const live = clients.get(slug);
  if (live) return live;
  const stored = readStored();
  if (stored?.slug === slug) {
    clients.set(slug, { ...stored, attempts: stored.attempts ?? 0, dead: stored.dead ?? false });
    return clients.get(slug) ?? null;
  }
  return null;
}

export function mockIdentityMode(): IdentityMode {
  try {
    return localStorage.getItem(STORAGE_MODE) === 'phone' ? 'phone' : 'otp';
  } catch {
    return 'otp';
  }
}

export function mockBirthdayField(): BirthdayField {
  return 'required';
}

export function mockPublicConfig(): { identityMode: IdentityMode; birthdayField: BirthdayField } {
  return { identityMode: mockIdentityMode(), birthdayField: mockBirthdayField() };
}

function profileOf(client: MockClient): PublicClientProfile {
  const needsBirthday =
    mockBirthdayField() === 'required' &&
    (!client.hasCustomer || !client.birthday?.day || !client.birthday?.month);
  return {
    verified: client.verified,
    hasCustomer: client.hasCustomer,
    needsBirthday,
    ...(client.verified && client.firstName ? { firstName: client.firstName } : {}),
  };
}

export function mockSessionMe(slug: string): PublicClientProfile | null {
  const client = clientFor(slug);
  if (!client) return null;
  return profileOf(client);
}

export function mockIdentifyStart(slug: string, phoneRaw: string): { status: 'known' | 'new' | 'blocked' } {
  const phone = digits(phoneRaw);
  if (phone === BLOCKED_PHONE) return { status: 'blocked' };
  const known = phone === KNOWN_PHONE;
  const existing = clientFor(slug);
  const client: MockClient = {
    slug,
    phone,
    verified: mockIdentityMode() === 'otp' ? false : existing?.verified === true && existing.phone === phone,
    hasCustomer: known || (existing?.phone === phone && existing.hasCustomer),
    firstName: known ? 'נועה' : existing?.phone === phone ? existing.firstName : undefined,
    birthday: known ? { day: 2, month: 3 } : existing?.phone === phone ? existing.birthday : undefined,
    attempts: 0,
    dead: false,
  };
  if (mockIdentityMode() === 'phone') {
    client.verified = false;
  }
  clients.set(slug, client);
  persist(client, slug);
  return { status: known || client.hasCustomer ? 'known' : 'new' };
}

export function mockIdentifyVerify(
  slug: string,
  phoneRaw: string,
  code: string
): { ok: true; status: 'known' | 'new' } | { ok: false; reason: 'invalid' | 'cap' } {
  if (mockIdentityMode() !== 'otp') return { ok: false, reason: 'invalid' };
  const client = clientFor(slug);
  const phone = digits(phoneRaw);
  if (!client || client.phone !== phone || client.dead) return { ok: false, reason: 'invalid' };
  if (code.trim() !== MOCK_CODE) {
    client.attempts += 1;
    if (client.attempts >= 5) {
      client.dead = true;
      persist(client, slug);
      return { ok: false, reason: 'cap' };
    }
    persist(client, slug);
    return { ok: false, reason: 'invalid' };
  }
  client.verified = true;
  client.attempts = 0;
  client.dead = false;
  persist(client, slug);
  return { ok: true, status: client.hasCustomer ? 'known' : 'new' };
}

export function mockIdentifyComplete(
  slug: string,
  body: { name?: string; birthday?: { day: number; month: number } }
): PublicClientProfile | null {
  const client = clientFor(slug);
  if (!client) return null;
  const name = body.name?.trim();
  if (name) {
    client.hasCustomer = true;
    client.firstName = name.split(/\s+/)[0];
  }
  if (body.birthday) {
    client.birthday = body.birthday;
    client.hasCustomer = true;
  }
  if (!client.hasCustomer && name) client.hasCustomer = true;
  persist(client, slug);
  return profileOf(client);
}

function defaultUpcoming(): MockUpcoming {
  return {
    id: 'apt-upcoming',
    date: '2026-11-15',
    time: '11:00',
    status: 'confirmed',
    serviceName: 'מניקור',
    serviceId: 's1',
    canModify: true,
  };
}

export function mockUpcomingAppointment(): {
  appointment: MockUpcoming | null;
  appointments: MockUpcoming[];
  businessPhone: string | null;
} {
  const stored = readStored();
  if (!stored?.verified || !stored.hasCustomer) {
    return { appointment: null, appointments: [], businessPhone: null };
  }
  const client = clientFor(stored.slug);
  if (!client?.verified || !client.hasCustomer) {
    return { appointment: null, appointments: [], businessPhone: null };
  }
  if (client.upcoming === undefined) client.upcoming = defaultUpcoming();
  const appointment = client.upcoming;
  return {
    appointment,
    appointments: appointment ? [appointment] : [],
    businessPhone: '0501234567',
  };
}

export function mockCancelUpcoming(id: string): boolean {
  const stored = readStored();
  if (!stored?.verified) return false;
  const client = clientFor(stored.slug);
  if (!client?.upcoming || client.upcoming.id !== id || !client.upcoming.canModify) return false;
  client.upcoming = null;
  persist(client, client.slug);
  return true;
}

export function mockRescheduleUpcoming(
  id: string,
  date: string,
  time: string
): MockUpcoming | null {
  const stored = readStored();
  if (!stored?.verified) return null;
  const client = clientFor(stored.slug);
  if (!client?.upcoming || client.upcoming.id !== id || !client.upcoming.canModify) return null;
  if (time === '15:00') return null;
  client.upcoming = { ...client.upcoming, date, time };
  persist(client, client.slug);
  return client.upcoming;
}

export function mockLogout(slug: string): void {
  clients.delete(slug);
  persist(null, slug);
}

export function mockOffer(): { durationMinutes: number; price: number } {
  for (const client of clients.values()) {
    if (client.hasCustomer) return { durationMinutes: 45, price: 180 };
  }
  const stored = readStored();
  if (stored?.hasCustomer) return { durationMinutes: 45, price: 180 };
  return { durationMinutes: 60, price: 120 };
}
