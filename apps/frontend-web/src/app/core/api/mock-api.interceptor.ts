import {
  HttpInterceptorFn,
  HttpRequest,
  HttpResponse,
} from '@angular/common/http';
import { from, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  WORKING_HOURS_DAY_KEYS,
  createDefaultSlots,
} from '../working-hours/working-hours.util';

/** In-memory session store for appointments created during mock mode. */
const sessionCreatedAppointments: Record<string, unknown>[] = [];

/** Cached initial list from assets (loaded once per session). */
let initialAppointments: Record<string, unknown>[] | null = null;

/** In-memory services: seeded from JSON, then mutated by POST/PUT. */
let servicesStore: Record<string, unknown>[] | null = null;

/** Cached customers from assets (read-only). */
let initialCustomers: Record<string, unknown>[] | null = null;

/** GET /api/appointments (list only, no extra path segment). */
function isAppointmentsGetList(req: HttpRequest<unknown>): boolean {
  if (req.method !== 'GET') return false;
  const u = req.url.split('?')[0];
  return /\/api\/appointments\/?$/.test(u);
}

/** GET /api/appointments/:id (single document). */
function isAppointmentsGetOne(req: HttpRequest<unknown>): boolean {
  if (req.method !== 'GET') return false;
  const u = req.url.split('?')[0];
  const m = u.match(/\/api\/appointments\/([^/]+)$/);
  if (!m) return false;
  const seg = m[1];
  return seg !== 'week' && seg !== 'available-slots';
}

function isAppointmentsPatch(req: HttpRequest<unknown>): boolean {
  return req.method === 'PATCH' && /\/api\/appointments\/[^/]+$/.test(req.url.split('?')[0]);
}

function isAppointmentsPost(req: HttpRequest<unknown>): boolean {
  return req.method === 'POST' && req.url.includes('/api/appointments');
}

function isServicesGetList(req: HttpRequest<unknown>): boolean {
  return req.method === 'GET' && /\/api\/services\/?(\?|$)/.test(req.url);
}

function isServicesGetOne(req: HttpRequest<unknown>): boolean {
  return req.method === 'GET' && /\/api\/services\/[^/]+$/.test(req.url);
}

function isServicesPost(req: HttpRequest<unknown>): boolean {
  return req.method === 'POST' && req.url.includes('/api/services');
}

function isServicesPut(req: HttpRequest<unknown>): boolean {
  return (req.method === 'PUT' || req.method === 'PATCH') && /\/api\/services\/[^/]+$/.test(req.url);
}

function isCustomersGet(req: HttpRequest<unknown>): boolean {
  return req.method === 'GET' && req.url.includes('/api/customers');
}

function isAuthMeGet(req: HttpRequest<unknown>): boolean {
  return req.method === 'GET' && req.url.includes('/api/auth/me');
}

function isAuthLoginPost(req: HttpRequest<unknown>): boolean {
  return req.method === 'POST' && req.url.includes('/api/auth/login');
}

function isAuthLogoutPost(req: HttpRequest<unknown>): boolean {
  return req.method === 'POST' && req.url.includes('/api/auth/logout');
}

function isBusinessSettingsPatch(req: HttpRequest<unknown>): boolean {
  return req.method === 'PATCH' && req.url.includes('/api/business/settings');
}

function isAdminBusinessesGet(req: HttpRequest<unknown>): boolean {
  return req.method === 'GET' && req.url.includes('/api/admin/businesses');
}

function isAdminBusinessesPost(req: HttpRequest<unknown>): boolean {
  return req.method === 'POST' && req.url.includes('/api/admin/businesses');
}

function isAdminImpersonatePost(req: HttpRequest<unknown>): boolean {
  return req.method === 'POST' && req.url.includes('/api/admin/impersonate');
}

function isAdminStopImpersonatePost(req: HttpRequest<unknown>): boolean {
  return req.method === 'POST' && req.url.includes('/api/admin/stop-impersonate');
}

function adminUrlPath(req: HttpRequest<unknown>): string {
  try {
    const u = new URL(req.url, 'http://localhost');
    return u.pathname;
  } catch {
    return req.url.split('?')[0];
  }
}

function parseUrlQuery(req: HttpRequest<unknown>): URLSearchParams {
  try {
    return new URL(req.url, 'http://localhost').searchParams;
  } catch {
    const q = req.url.includes('?') ? req.url.split('?')[1] : '';
    return new URLSearchParams(q);
  }
}

const MOCK_ADMIN_USER_ROWS: Record<string, unknown>[] = [
  {
    id: 'mock-super-admin',
    email: 'superadmin@example.com',
    name: 'Super Admin',
    phone: null,
    role: 'super_admin',
    status: 'active',
    businessId: null,
    businessName: null,
    plan: null,
    createdAt: '2024-06-01T10:00:00.000Z',
    lastLoginAt: null,
  },
  {
    id: 'mock-user-1',
    email: 'owner@example.com',
    name: 'Demo Owner',
    phone: '+972501234567',
    role: 'owner',
    status: 'active',
    businessId: 'mock-business-1',
    businessName: 'Demo Salon',
    plan: 'pro',
    businessFeatures: {
      bookingEnabled: true,
      marketingModule: false,
      waitlistEnabled: false,
      analyticsEnabled: true,
    },
    createdAt: '2024-06-02T10:00:00.000Z',
    lastLoginAt: '2024-06-15T12:00:00.000Z',
  },
];

let mockPlatformSettingsState: {
  defaultTrialDurationDays: number;
  maintenanceMode: boolean;
  featureFlags: Record<string, boolean>;
  platformDisplayName: string;
  emailConfigurationNote: string;
  updatedAt: string;
} = {
  defaultTrialDurationDays: 14,
  maintenanceMode: false,
  featureFlags: { booking: true, marketing: false, waitlist: false },
  platformDisplayName: 'SaaS Booking (mock)',
  emailConfigurationNote: 'Mock: real SMTP is configured on the API server.',
  updatedAt: new Date().toISOString(),
};

const MOCK_AUDIT_ROWS: Record<string, unknown>[] = [
  {
    id: 'audit-1',
    timestamp: new Date().toISOString(),
    actor: 'superadmin@example.com',
    action: 'impersonation.start',
    entity: 'Business',
    entityId: 'mock-business-1',
    metadata: { businessId: 'mock-business-1' },
  },
];

function isPublicBusinessGet(req: HttpRequest<unknown>): boolean {
  return req.method === 'GET' && /\/api\/public\/[^/]+\/business\/?(\?|$)/.test(req.url);
}

function isPublicRequestOtpPost(req: HttpRequest<unknown>): boolean {
  return req.method === 'POST' && /\/api\/public\/[^/]+\/auth\/request-otp/.test(req.url);
}

function isPublicVerifyOtpPost(req: HttpRequest<unknown>): boolean {
  return req.method === 'POST' && /\/api\/public\/[^/]+\/auth\/verify-otp/.test(req.url);
}

function isPublicAuthMeGet(req: HttpRequest<unknown>): boolean {
  return req.method === 'GET' && /\/api\/public\/auth\/me\/?(\?|$)/.test(req.url);
}

function getPublicSlugFromUrl(url: string): string | null {
  const m = url.match(/\/api\/public\/([^/]+)\//);
  return m ? m[1] : null;
}

/** GET /api/public/businesses/:slug only (no /services, /availability, /landing). Uses path without query. */
function isPublicBusinessesGet(req: HttpRequest<unknown>): boolean {
  if (req.method !== 'GET') return false;
  const u = req.url.split('?')[0];
  return /\/api\/public\/businesses\/[^/]+\/?$/.test(u);
}

/** GET /api/public/businesses/:slug/landing */
function isPublicBusinessesLandingGet(req: HttpRequest<unknown>): boolean {
  if (req.method !== 'GET') return false;
  const u = req.url.split('?')[0];
  return /\/api\/public\/businesses\/[^/]+\/landing\/?$/.test(u);
}

function isPublicBusinessesServicesGet(req: HttpRequest<unknown>): boolean {
  return req.method === 'GET' && /\/api\/public\/businesses\/[^/]+\/services\/?(\?|$)/.test(req.url);
}

function isPublicBusinessesAvailabilityGet(req: HttpRequest<unknown>): boolean {
  return req.method === 'GET' && /\/api\/public\/businesses\/[^/]+\/availability/.test(req.url);
}

function isPublicAppointmentsPost(req: HttpRequest<unknown>): boolean {
  return req.method === 'POST' && /\/api\/public\/appointments\/?(\?|$)/.test(req.url);
}

function getPublicBusinessesSlugFromUrl(url: string): string | null {
  const m = url.match(/\/api\/public\/businesses\/([^/]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

/** Mock impersonation token = base64(JSON.stringify({ impersonatingBusinessId })). */
function getImpersonationFromRequest(req: HttpRequest<unknown>): { impersonatingBusinessId: string } | null {
  const auth = req.headers.get('Authorization');
  if (!auth || !auth.startsWith('Bearer ')) return null;
  const token = auth.slice(7).trim();
  if (!token) return null;
  try {
    const payload = JSON.parse(atob(token)) as { impersonatingBusinessId?: string };
    if (payload && typeof payload.impersonatingBusinessId === 'string') {
      return { impersonatingBusinessId: payload.impersonatingBusinessId };
    }
  } catch {
    // ignore
  }
  return null;
}

/** In-memory: who is logged in (owner vs super_admin). Used when no Bearer. */
let mockCurrentUser: { role: 'owner'; businessId: string } | { role: 'super_admin' } = {
  role: 'owner',
  businessId: 'mock-business-1',
};

/** False until a successful mock POST /auth/login (fresh browser / reload = logged out). */
let mockAuthenticated = false;

const SB_MOCK_AUTH_KEY = 'sb_mock_authenticated';
const SB_MOCK_ROLE_KEY = 'sb_mock_role';
const SB_MOCK_BIZ_KEY = 'sb_mock_business_id';

function syncMockSessionFromStorage(): void {
  if (typeof sessionStorage === 'undefined') return;
  if (sessionStorage.getItem(SB_MOCK_AUTH_KEY) !== '1') return;
  mockAuthenticated = true;
  const role = sessionStorage.getItem(SB_MOCK_ROLE_KEY);
  if (role === 'super_admin') {
    mockCurrentUser = { role: 'super_admin' };
    return;
  }
  if (role === 'owner') {
    const bid = sessionStorage.getItem(SB_MOCK_BIZ_KEY) || 'mock-business-1';
    mockCurrentUser = { role: 'owner', businessId: bid };
  }
}

function persistMockSessionToStorage(): void {
  if (typeof sessionStorage === 'undefined') return;
  sessionStorage.setItem(SB_MOCK_AUTH_KEY, '1');
  if (mockCurrentUser.role === 'super_admin') {
    sessionStorage.setItem(SB_MOCK_ROLE_KEY, 'super_admin');
    sessionStorage.removeItem(SB_MOCK_BIZ_KEY);
  } else {
    sessionStorage.setItem(SB_MOCK_ROLE_KEY, 'owner');
    sessionStorage.setItem(SB_MOCK_BIZ_KEY, mockCurrentUser.businessId);
  }
}

function clearMockSessionStorage(): void {
  if (typeof sessionStorage === 'undefined') return;
  sessionStorage.removeItem(SB_MOCK_AUTH_KEY);
  sessionStorage.removeItem(SB_MOCK_ROLE_KEY);
  sessionStorage.removeItem(SB_MOCK_BIZ_KEY);
}

const mockAlertDismissed = new Set<string>();
const mockAlertResolved = new Set<string>();

function mockAlertsList(): {
  id: string;
  severity: string;
  category: string;
  title: string;
  message: string;
  createdAt: string;
}[] {
  const now = new Date().toISOString();
  const all = [
    {
      id: 'mock-alert-inactive',
      severity: 'warning',
      category: 'engagement',
      title: 'Inactive business (30+ days)',
      message: 'Second Salon has had no recent appointments in the mock dataset.',
      createdAt: now,
    },
    {
      id: 'mock-alert-payments',
      severity: 'info',
      category: 'payments',
      title: 'Payment activity',
      message: '1 business has online payments enabled in mock data — monitor failed charges.',
      createdAt: now,
    },
  ];
  return all.filter((a) => !mockAlertDismissed.has(a.id) && !mockAlertResolved.has(a.id));
}

const MOCK_BUSINESSES: Record<string, unknown>[] = [
  {
    _id: 'mock-business-1',
    name: 'Demo Salon',
    slug: 'demo-salon',
    plan: 'pro',
    ownerEmail: 'owner@example.com',
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-01-01T00:00:00.000Z',
    ui: { themeMode: 'light' },
  },
  {
    _id: 'mock-business-2',
    name: 'Second Salon',
    slug: 'second-salon',
    plan: 'free',
    ownerEmail: 'owner2@example.com',
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-01-01T00:00:00.000Z',
    ui: { themeMode: 'light' },
  },
];

function getMockBusinessById(businessId: string): Record<string, unknown> | null {
  const b = MOCK_BUSINESSES.find((x) => String(x['_id']) === businessId);
  return b ? { ...b } : null;
}

function loadInitialAppointments(): Promise<Record<string, unknown>[]> {
  if (initialAppointments !== null) {
    return Promise.resolve(initialAppointments);
  }
  return fetch('/assets/mocks/appointments.json')
    .then((r) => r.json())
    .then((list: Record<string, unknown>[]) => {
      initialAppointments = list;
      return initialAppointments;
    });
}

function loadInitialServices(): Promise<Record<string, unknown>[]> {
  if (servicesStore !== null) {
    return Promise.resolve(servicesStore);
  }
  return fetch('/assets/mocks/services.json')
    .then((r) => r.json())
    .then((list: Record<string, unknown>[]) => {
      servicesStore = list.map((s) => ({ ...s }));
      return servicesStore!;
    });
}

function loadInitialCustomers(): Promise<Record<string, unknown>[]> {
  if (initialCustomers !== null) {
    return Promise.resolve(initialCustomers);
  }
  return fetch('/assets/mocks/customers.json')
    .then((r) => r.json())
    .then((list: Record<string, unknown>[]) => {
      initialCustomers = list;
      return initialCustomers;
    });
}

function createMockId(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(12)))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function buildDefaultWorkingHours(): Record<string, { enabled: boolean; slots: boolean[] }> {
  const out: Record<string, { enabled: boolean; slots: boolean[] }> = {};
  for (const key of WORKING_HOURS_DAY_KEYS) {
    out[key] = {
      enabled: key !== 'sat',
      slots: createDefaultSlots(key),
    };
  }
  return out;
}

const DEFAULT_WORKING_HOURS = buildDefaultWorkingHours();

let mockBusinessSettings: AuthMeResponse['businessSettings'] = {
  theme: null,
  workingHours: (() => {
    const wh: Record<string, { enabled: boolean; slots: boolean[] }> = {};
    for (const k of WORKING_HOURS_DAY_KEYS) {
      wh[k] = { enabled: DEFAULT_WORKING_HOURS[k].enabled, slots: [...DEFAULT_WORKING_HOURS[k].slots] };
    }
    return wh;
  })(),
};

/** Owner auth/me response (Demo Salon). */
function mockAuthMeResponseOwner(): AuthMeResponse {
  const wh = mockBusinessSettings?.workingHours;
  const workingHours =
    wh && typeof wh === 'object'
      ? Object.fromEntries(
          Object.entries(wh).map(([k, v]) => [
            k,
            v && Array.isArray((v as { slots?: unknown }).slots)
              ? { enabled: (v as { enabled: boolean }).enabled, slots: [...(v as { slots: boolean[] }).slots] }
              : v,
          ])
        )
      : buildDefaultWorkingHours();
  return {
    user: {
      id: 'mock-user-1',
      email: 'owner@example.com',
      role: 'owner',
      businessId: 'mock-business-1',
      businessSlug: 'demo-salon',
    },
    business: {
      _id: 'mock-business-1',
      name: 'Demo Salon',
      slug: 'demo-salon',
      ownerEmail: 'owner@example.com',
      ui: { themeMode: 'light' },
    },
    businessSettings: {
      theme: mockBusinessSettings?.theme ?? null,
      workingHours,
    },
  };
}

/** Build auth/me from request: Bearer => super_admin + business or null; no Bearer => mockCurrentUser. */
function mockAuthMeResponse(req: HttpRequest<unknown>): AuthMeResponse {
  const imp = getImpersonationFromRequest(req);
  const superAdminUser = {
    id: 'mock-super-admin',
    email: 'superadmin@example.com',
    role: 'super_admin' as const,
  };

  if (imp) {
    const business = getMockBusinessById(imp.impersonatingBusinessId);
    const workingHours = buildDefaultWorkingHours();
    return {
    user: { ...superAdminUser },
    business: business
      ? {
          _id: String(business['_id']),
          name: String(business['name']),
          slug: String(business['slug']),
          ownerEmail: business['ownerEmail'] != null ? String(business['ownerEmail']) : null,
          ui: (business['ui'] as { themeMode?: string } | undefined) ?? undefined,
        }
      : null,
    businessSettings: business
      ? { theme: (business['ui'] as { themeMode?: string }) ?? null, workingHours }
      : null,
    };
  }

  if (mockCurrentUser.role === 'super_admin') {
    return {
      user: { ...superAdminUser },
      business: null,
      businessSettings: null,
    };
  }

  return mockAuthMeResponseOwner();
}

/** Assign businessId by index for filtering (even => mock-business-1, odd => mock-business-2). */
function withMockBusinessIds<T extends Record<string, unknown>>(list: T[]): (T & { businessId: string })[] {
  return list.map((item, i) => ({
    ...item,
    businessId: i % 2 === 0 ? 'mock-business-1' : 'mock-business-2',
  }));
}

interface AuthMeResponse {
  user: { id: string; email: string; role: string; businessId?: string; businessSlug?: string };
  business?: { _id: string; name: string; slug: string; ownerEmail?: string | null; ui?: { themeMode?: string } } | null;
  businessSettings?: {
    theme: unknown;
    workingHours?: Record<string, { enabled: boolean; slots: boolean[] }>;
  } | null;
}

export const mockApiInterceptor: HttpInterceptorFn = (req, next) => {
  if (!environment.useMocks) {
    return next(req);
  }

  syncMockSessionFromStorage();

  // ——— Auth (evaluate before other handlers) ———
  if (isAuthLogoutPost(req)) {
    mockAuthenticated = false;
    clearMockSessionStorage();
    return from([new HttpResponse({ status: 200, body: { success: true } })]);
  }

  if (isAuthLoginPost(req)) {
    const body = req.body as Record<string, unknown>;
    const email = String(body['email'] ?? '').toLowerCase();
    if (email === 'superadmin@example.com') {
      mockCurrentUser = { role: 'super_admin' };
      mockAuthenticated = true;
      persistMockSessionToStorage();
      return from([
        new HttpResponse({
          status: 200,
          body: {
            user: {
              id: 'mock-super-admin',
              email: 'superadmin@example.com',
              role: 'super_admin',
            },
          },
        }),
      ]);
    }
    mockCurrentUser = { role: 'owner', businessId: 'mock-business-1' };
    mockAuthenticated = true;
    persistMockSessionToStorage();
    return from([
      new HttpResponse({
        status: 200,
        body: {
          user: {
            id: 'mock-user-1',
            email: 'owner@example.com',
            role: 'owner',
            businessId: 'mock-business-1',
          },
        },
      }),
    ]);
  }

  if (isAuthMeGet(req)) {
    if (!mockAuthenticated) {
      return from([
        new HttpResponse({
          status: 401,
          body: { message: 'Not authenticated (mock)' },
        }),
      ]);
    }
    return from([new HttpResponse({ status: 200, body: mockAuthMeResponse(req) })]);
  }

  // ——— Appointments ———
  if (isAppointmentsGetOne(req)) {
    const match = req.url.split('?')[0].match(/\/api\/appointments\/([^/]+)$/);
    const id = match ? decodeURIComponent(match[1]) : '';
    const imp = getImpersonationFromRequest(req);
    return from(loadInitialAppointments()).pipe(
      map((list) => {
        const withIds = withMockBusinessIds(list);
        const merged = [...withIds, ...sessionCreatedAppointments];
        const filtered = imp
          ? merged.filter((a) => String(a['businessId'] ?? '') === imp.impersonatingBusinessId)
          : merged;
        const row = filtered.find((a) => String(a['_id']) === id);
        if (!row) {
          return new HttpResponse({ status: 404, body: { message: 'Appointment not found' } });
        }
        const body = {
          appointmentId: String(row['_id']),
          customerId: row['customerId'] != null ? String(row['customerId']) : null,
          serviceId: row['serviceId'] != null ? String(row['serviceId']) : '',
          customerName: String(row['customerName'] ?? 'לקוח'),
          customerPhone: (row['customerPhone'] as string | null) ?? null,
          serviceName: String(row['serviceName'] ?? 'שירות'),
          durationMinutes: Number(row['durationMinutes'] ?? 30),
          price: typeof row['price'] === 'number' ? row['price'] : undefined,
          start: String(row['start']),
          end: String(row['end']),
          status: String(row['status'] ?? 'confirmed'),
          notes: (row['notes'] as string | null) ?? null,
        };
        return new HttpResponse({ status: 200, body });
      })
    );
  }

  if (isAppointmentsGetList(req)) {
    const imp = getImpersonationFromRequest(req);
    return from(loadInitialAppointments()).pipe(
      map((list) => {
        const withIds = withMockBusinessIds(list);
        const merged = [...withIds, ...sessionCreatedAppointments];
        merged.sort((a, b) => {
          const aStart = String(a['start'] ?? '');
          const bStart = String(b['start'] ?? '');
          return aStart.localeCompare(bStart);
        });
        const filtered = imp
          ? merged.filter((a) => String(a['businessId'] ?? '') === imp.impersonatingBusinessId)
          : merged;
        return new HttpResponse({ status: 200, body: filtered });
      })
    );
  }

  if (isAppointmentsPatch(req)) {
    const match = req.url.split('?')[0].match(/\/api\/appointments\/([^/]+)$/);
    const id = match ? decodeURIComponent(match[1]) : '';
    const body = req.body as Record<string, unknown>;
    const idx = sessionCreatedAppointments.findIndex((a) => String(a['_id']) === id);
    if (idx >= 0) {
      const cur = { ...sessionCreatedAppointments[idx] };
      if (body['start']) cur['start'] = body['start'];
      if (body['end']) cur['end'] = body['end'];
      if (body['status']) cur['status'] = body['status'];
      if (body['notes'] !== undefined) cur['notes'] = body['notes'];
      if (body['customerId']) cur['customerId'] = body['customerId'];
      if (body['serviceId']) cur['serviceId'] = body['serviceId'];
      if (body['price'] !== undefined) cur['price'] = body['price'];
      sessionCreatedAppointments[idx] = cur;
      return from([new HttpResponse({ status: 200, body: cur })]);
    }
    return from([
      new HttpResponse({ status: 404, body: { message: 'Appointment not found (mock)' } }),
    ]);
  }

  if (isAppointmentsPost(req)) {
    const imp = getImpersonationFromRequest(req);
    const body = req.body as Record<string, unknown>;
    const now = new Date().toISOString();
    const businessId =
      imp?.impersonatingBusinessId ??
      (mockCurrentUser.role === 'owner' ? mockCurrentUser.businessId : 'mock-business-1');
    const created = {
      _id: createMockId(),
      customerId: body['customerId'] ?? null,
      serviceId: body['serviceId'] ?? null,
      start: body['start'],
      end: body['end'],
      status: 'confirmed',
      source: 'owner',
      notes: body['notes'] ?? null,
      createdAt: now,
      updatedAt: now,
      businessId,
    };
    sessionCreatedAppointments.push(created);
    return from([new HttpResponse({ status: 201, body: created })]);
  }

  // ——— Services ———
  if (isServicesGetList(req)) {
    return from(loadInitialServices()).pipe(
      map((list) => new HttpResponse({ status: 200, body: [...list] }))
    );
  }

  if (isServicesGetOne(req)) {
    const match = req.url.match(/\/api\/services\/([^/]+)$/);
    const id = match ? decodeURIComponent(match[1]) : '';
    return from(loadInitialServices()).pipe(
      map((list) => {
        const service = list.find((s) => String(s['_id']) === id);
        if (!service) {
          return new HttpResponse({ status: 404, body: { message: 'Service not found' } });
        }
        return new HttpResponse({ status: 200, body: { ...service } });
      })
    );
  }

  if (isServicesPost(req)) {
    const body = req.body as Record<string, unknown>;
    const now = new Date().toISOString();
    const created = {
      _id: createMockId(),
      name: body['name'] ?? '',
      durationMinutes: body['durationMinutes'] ?? 30,
      price: body['price'] ?? undefined,
      description: body['description'] ?? undefined,
      isActive: body['isActive'] !== false,
      createdAt: now,
    };
    servicesStore = servicesStore ?? [];
    servicesStore.push(created);
    return from([new HttpResponse({ status: 201, body: created })]);
  }

  if (isServicesPut(req)) {
    const match = req.url.match(/\/api\/services\/([^/]+)$/);
    const id = match ? decodeURIComponent(match[1]) : '';
    const body = req.body as Record<string, unknown>;
    return from(loadInitialServices()).pipe(
      map((list) => {
        const idx = list.findIndex((s) => String(s['_id']) === id);
        if (idx === -1) {
          return new HttpResponse({ status: 404, body: { message: 'Service not found' } });
        }
        const updated = { ...list[idx], ...body, _id: id } as Record<string, unknown>;
        list[idx] = updated;
        return new HttpResponse({ status: 200, body: updated });
      })
    );
  }

  // ——— Customers (read-only) ———
  if (isCustomersGet(req)) {
    const imp = getImpersonationFromRequest(req);
    return from(loadInitialCustomers()).pipe(
      map((list) => {
        const withIds = withMockBusinessIds(list);
        const filtered = imp
          ? withIds.filter((c) => c.businessId === imp.impersonatingBusinessId)
          : withIds;
        return new HttpResponse({ status: 200, body: [...filtered] });
      })
    );
  }

  // ——— Admin: businesses list, impersonate, stop-impersonate ———
  if (isAdminBusinessesGet(req)) {
    return from([new HttpResponse({ status: 200, body: [...MOCK_BUSINESSES] })]);
  }

  if (isAdminBusinessesPost(req)) {
    const body = req.body as Record<string, unknown>;
    const bizId = `mock-business-${Date.now()}`;
    const ownerId = `mock-owner-${Date.now()}`;
    const businessName = String(body['businessName'] ?? 'New business').trim();
    const slugRaw = String(body['businessSlug'] ?? '').trim();
    const slug =
      slugRaw.length > 0
        ? slugRaw
            .toLowerCase()
            .replace(/[^a-z0-9-]+/g, '-')
            .replace(/^-|-$/g, '')
            .slice(0, 60) || `biz-${bizId.slice(-4)}`
        : (businessName
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '') || 'business') + `-${bizId.slice(-4)}`;
    const plan = (body['plan'] as string) || 'free';
    MOCK_BUSINESSES.push({
      _id: bizId,
      name: businessName,
      slug,
      plan,
      ownerEmail: body['ownerEmail'],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ui: { themeMode: 'light' },
    });
    MOCK_ADMIN_USER_ROWS.push({
      id: ownerId,
      email: String(body['ownerEmail'] ?? '').toLowerCase(),
      name: String(body['ownerFullName'] ?? ''),
      phone: body['ownerPhone'] ? String(body['ownerPhone']) : null,
      role: 'owner',
      status: 'active',
      businessId: bizId,
      businessName,
      plan,
      createdAt: new Date().toISOString(),
      lastLoginAt: null,
    });
    return from([
      new HttpResponse({
        status: 201,
        body: {
          business: {
            _id: bizId,
            name: businessName,
            slug,
            plan,
            phone: body['ownerPhone'] ? String(body['ownerPhone']) : null,
            ownerId,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
          owner: {
            id: ownerId,
            email: String(body['ownerEmail'] ?? ''),
            name: String(body['ownerFullName'] ?? ''),
            phone: body['ownerPhone'] ? String(body['ownerPhone']) : null,
            role: 'owner',
            status: 'active',
            businessId: bizId,
            createdAt: new Date().toISOString(),
          },
          settings: { plan, features: {}, localization: { timezone: body['timezone'] ?? 'Asia/Jerusalem' } },
          defaultService: { _id: 'mock-svc', name: 'Consultation', durationMinutes: 60, price: 0, isActive: true },
          credentialsSentVia: 'server_log',
        },
      }),
    ]);
  }

  if (isAdminImpersonatePost(req)) {
    const body = req.body as Record<string, unknown>;
    const businessId = String(body['businessId'] ?? '');
    const token = btoa(
      JSON.stringify({ impersonatingBusinessId: businessId, impersonating: true })
    );
    return from([
      new HttpResponse({
        status: 200,
        body: { token, impersonatingBusinessId: businessId },
      }),
    ]);
  }

  if (isAdminStopImpersonatePost(req)) {
    return from([new HttpResponse({ status: 200, body: { ok: true } })]);
  }

  // ——— Admin: users, settings, analytics, audit (mock) ———
  const adminPath = adminUrlPath(req);
  if (req.method === 'GET' && /\/api\/admin\/users\/?$/.test(adminPath)) {
    const q = parseUrlQuery(req);
    const page = Math.max(1, parseInt(q.get('page') || '1', 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(q.get('limit') || '20', 10) || 20));
    const search = (q.get('search') || '').toLowerCase();
    const role = q.get('role') || '';
    const status = q.get('status') || '';
    let list = MOCK_ADMIN_USER_ROWS.map((r) => ({ ...r }));
    if (search) {
      list = list.filter(
        (r) =>
          String(r['email']).toLowerCase().includes(search) ||
          String(r['name'] || '').toLowerCase().includes(search)
      );
    }
    if (role) list = list.filter((r) => r['role'] === role);
    if (status) list = list.filter((r) => r['status'] === status);
    const total = list.length;
    const start = (page - 1) * limit;
    const items = list.slice(start, start + limit);
    return from([new HttpResponse({ status: 200, body: { items, total, page, limit } })]);
  }
  const adminUserOne = req.method === 'GET' && adminPath.match(/\/api\/admin\/users\/([^/]+)$/);
  if (adminUserOne) {
    const id = adminUserOne[1];
    const row = MOCK_ADMIN_USER_ROWS.find((r) => r['id'] === id);
    if (!row) {
      return from([new HttpResponse({ status: 404, body: { message: 'Not found' } })]);
    }
    return from([
      new HttpResponse({
        status: 200,
        body: {
          ...row,
          updatedAt: row['createdAt'],
        },
      }),
    ]);
  }
  const adminUserDelete = req.method === 'DELETE' && adminPath.match(/\/api\/admin\/users\/([^/]+)$/);
  if (adminUserDelete) {
    const id = adminUserDelete[1];
    const idx = MOCK_ADMIN_USER_ROWS.findIndex((r) => r['id'] === id);
    if (idx < 0) {
      return from([new HttpResponse({ status: 404, body: { message: 'Not found' } })]);
    }
    const row = MOCK_ADMIN_USER_ROWS[idx];
    if (row['role'] === 'super_admin' || row['role'] === 'owner') {
      return from([
        new HttpResponse({
          status: 400,
          body: { message: 'Cannot delete this user in mock mode.' },
        }),
      ]);
    }
    MOCK_ADMIN_USER_ROWS.splice(idx, 1);
    return from([new HttpResponse({ status: 204, body: null })]);
  }
  const adminUserPlanPatch =
    req.method === 'PATCH' && adminPath.match(/\/api\/admin\/users\/([^/]+)\/plan$/);
  if (adminUserPlanPatch) {
    const id = adminUserPlanPatch[1];
    const row = MOCK_ADMIN_USER_ROWS.find((r) => r['id'] === id);
    if (!row) {
      return from([new HttpResponse({ status: 404, body: { message: 'Not found' } })]);
    }
    const body = req.body as Record<string, unknown>;
    const nextPlan = body['plan'];
    if (nextPlan !== 'free' && nextPlan !== 'pro' && nextPlan !== 'premium') {
      return from([new HttpResponse({ status: 400, body: { message: 'Invalid plan' } })]);
    }
    if (!row['businessId']) {
      return from([
        new HttpResponse({ status: 400, body: { message: 'User has no linked business' } }),
      ]);
    }
    row['plan'] = nextPlan;
    const biz = MOCK_BUSINESSES.find((b) => String(b['_id']) === String(row['businessId']));
    if (biz) {
      biz['plan'] = nextPlan;
    }
    return from([new HttpResponse({ status: 200, body: { ...row } })]);
  }
  const adminUserPatch = req.method === 'PATCH' && adminPath.match(/\/api\/admin\/users\/([^/]+)$/);
  if (adminUserPatch) {
    const id = adminUserPatch[1];
    const row = MOCK_ADMIN_USER_ROWS.find((r) => r['id'] === id);
    if (!row) {
      return from([new HttpResponse({ status: 404, body: { message: 'Not found' } })]);
    }
    const body = req.body as Record<string, unknown>;
    if (body['status'] === 'active' || body['status'] === 'disabled') {
      row['status'] = body['status'];
    }
    if (typeof body['name'] === 'string') {
      row['name'] = body['name'];
    }
    if (typeof body['email'] === 'string') {
      row['email'] = String(body['email']).toLowerCase().trim();
    }
    const nextRole = body['role'];
    if (
      (nextRole === 'staff' || nextRole === 'client') &&
      row['role'] !== 'super_admin' &&
      row['role'] !== 'owner'
    ) {
      row['role'] = nextRole;
    }
    const bf = body['businessFeatures'];
    if (bf && typeof bf === 'object' && !Array.isArray(bf)) {
      const cur = (row['businessFeatures'] as Record<string, boolean> | undefined) ?? {};
      const inc = bf as Record<string, unknown>;
      row['businessFeatures'] = {
        bookingEnabled:
          typeof inc['bookingEnabled'] === 'boolean' ? inc['bookingEnabled'] : cur['bookingEnabled'] ?? true,
        marketingModule:
          typeof inc['marketingModule'] === 'boolean' ? inc['marketingModule'] : cur['marketingModule'] ?? false,
        waitlistEnabled:
          typeof inc['waitlistEnabled'] === 'boolean' ? inc['waitlistEnabled'] : cur['waitlistEnabled'] ?? false,
        analyticsEnabled:
          typeof inc['analyticsEnabled'] === 'boolean' ? inc['analyticsEnabled'] : cur['analyticsEnabled'] ?? false,
      };
    }
    return from([new HttpResponse({ status: 200, body: { ...row } })]);
  }
  if (req.method === 'GET' && /\/api\/admin\/settings\/?$/.test(adminPath)) {
    return from([
      new HttpResponse({
        status: 200,
        body: { ...mockPlatformSettingsState },
      }),
    ]);
  }
  if (req.method === 'PATCH' && /\/api\/admin\/settings\/?$/.test(adminPath)) {
    const body = req.body as Record<string, unknown>;
    mockPlatformSettingsState = {
      ...mockPlatformSettingsState,
      ...(typeof body['defaultTrialDurationDays'] === 'number'
        ? { defaultTrialDurationDays: body['defaultTrialDurationDays'] as number }
        : {}),
      ...(typeof body['maintenanceMode'] === 'boolean'
        ? { maintenanceMode: body['maintenanceMode'] as boolean }
        : {}),
      ...(body['featureFlags'] && typeof body['featureFlags'] === 'object'
        ? { featureFlags: body['featureFlags'] as Record<string, boolean> }
        : {}),
      ...(typeof body['platformDisplayName'] === 'string'
        ? { platformDisplayName: body['platformDisplayName'] as string }
        : {}),
      updatedAt: new Date().toISOString(),
    };
    return from([new HttpResponse({ status: 200, body: { ...mockPlatformSettingsState } })]);
  }
  if (req.method === 'GET' && /\/api\/admin\/overview\/?$/.test(adminPath)) {
    const body = {
      totalBusinesses: MOCK_BUSINESSES.length,
      activeBusinesses: MOCK_BUSINESSES.length,
      totalAppointments: 42,
      appointmentsThisMonth: 12,
      appointmentsLastMonth: 8,
      monthOverMonthGrowthPercent: 50,
      totalRevenue: 18_200,
      newBusinessesThisMonth: 1,
      newBusinessesLastMonth: 0,
      businessesMonthOverMonthGrowthPercent: 100,
      topPerformingBusiness: { name: 'Demo Salon', bookingCount: 9 },
      avgBookingsPerBusiness: 21,
      insights: [
        'Mock mode: connect the app to the real API for idle-business and capacity insights.',
        'Appointments up 50% this month vs last month.',
        '1 business is on the Free plan with their service catalog near the plan limit — upsell opportunity.',
      ],
      chartAppointmentsByMonth: [
        { period: '2024-01', count: 4 },
        { period: '2024-02', count: 6 },
        { period: '2024-03', count: 5 },
        { period: '2024-04', count: 8 },
        { period: '2024-05', count: 7 },
        { period: '2024-06', count: 12 },
      ],
    };
    return from([new HttpResponse({ status: 200, body })]);
  }
  if (req.method === 'GET' && /\/api\/admin\/analytics\/?$/.test(adminPath)) {
    const q = parseUrlQuery(req);
    const range = q.get('range') || '7d';
    let days = range === '90d' ? 90 : range === '30d' ? 30 : 7;
    if (range === 'custom') {
      const fromD = q.get('from');
      const toD = q.get('to');
      if (fromD && toD) {
        const a = new Date(fromD).getTime();
        const b = new Date(toD).getTime();
        if (!Number.isNaN(a) && !Number.isNaN(b) && b >= a) {
          days = Math.max(1, Math.ceil((b - a) / 86400000));
        }
      }
    }
    const body = {
      rangeDays: days,
      totals: {
        businesses: MOCK_BUSINESSES.length,
        activeBusinesses: MOCK_BUSINESSES.length,
        users: MOCK_ADMIN_USER_ROWS.length,
        appointments: 42,
        appointmentsInRange: 12,
        revenueInRange: 4800,
        totalRevenue: 128_500,
        revenueLast30Days: 18_200,
        mrr: 49,
        arpu: 64250,
        payingBusinesses: 1,
        newUserSignups: 2,
        newBusinessesInRange: 1,
        churnRiskBusinesses: 0,
      },
      charts: {
        appointmentsByDay: [
          { date: '2024-06-10', count: 2 },
          { date: '2024-06-11', count: 4 },
          { date: '2024-06-12', count: 3 },
        ],
        newBusinessesByWeek: [{ label: '2024-W23', count: 1 }],
        planDistribution: [
          { plan: 'free', count: 1 },
          { plan: 'normal', count: 1 },
        ],
        revenueByDay: [
          { date: '2024-06-10', amount: 1200 },
          { date: '2024-06-11', amount: 2100 },
          { date: '2024-06-12', amount: 1500 },
        ],
      },
    };
    return from([new HttpResponse({ status: 200, body })]);
  }
  if (req.method === 'GET' && /\/api\/admin\/alerts\/count\/?$/.test(adminPath)) {
    const items = mockAlertsList();
    return from([new HttpResponse({ status: 200, body: { count: items.length } })]);
  }
  if (req.method === 'GET' && /\/api\/admin\/alerts\/?$/.test(adminPath)) {
    const items = mockAlertsList();
    return from([
      new HttpResponse({ status: 200, body: { items, activeCount: items.length } }),
    ]);
  }
  const dismissAlert =
    req.method === 'PATCH' && adminPath.match(/\/api\/admin\/alerts\/([^/]+)\/dismiss$/);
  if (dismissAlert) {
    mockAlertDismissed.add(dismissAlert[1]);
    const items = mockAlertsList();
    return from([new HttpResponse({ status: 200, body: { ok: true, activeCount: items.length } })]);
  }
  const resolveAlert =
    req.method === 'PATCH' && adminPath.match(/\/api\/admin\/alerts\/([^/]+)\/resolve$/);
  if (resolveAlert) {
    mockAlertResolved.add(resolveAlert[1]);
    const items = mockAlertsList();
    return from([new HttpResponse({ status: 200, body: { ok: true, activeCount: items.length } })]);
  }
  if (req.method === 'GET' && /\/api\/admin\/audit\/?$/.test(adminPath)) {
    const q = parseUrlQuery(req);
    const page = Math.max(1, parseInt(q.get('page') || '1', 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(q.get('limit') || '25', 10) || 25));
    const search = (q.get('search') || '').toLowerCase();
    let list = [...MOCK_AUDIT_ROWS];
    if (search) {
      list = list.filter(
        (r) =>
          String(r['actor']).toLowerCase().includes(search) ||
          String(r['action']).toLowerCase().includes(search) ||
          String(r['entityId']).toLowerCase().includes(search)
      );
    }
    const total = list.length;
    const start = (page - 1) * limit;
    const items = list.slice(start, start + limit);
    return from([new HttpResponse({ status: 200, body: { items, total, page, limit } })]);
  }

  // ——— Public (customer booking: business by slug, request-otp, verify-otp) ———
  if (isPublicBusinessGet(req)) {
    const slug = getPublicSlugFromUrl(req.url);
    if (!slug) return next(req);
    const known = MOCK_BUSINESSES.find((b) => String(b['slug']) === slug) as Record<string, unknown> | undefined;
    const businessId = known ? String(known['_id']) : 'mock-business-1';
    const name = known ? String(known['name']) : (slug === 'demo-salon' ? 'Demo Salon' : slug);
    return from([
      new HttpResponse({
        status: 200,
        body: {
          businessId,
          name,
          slug,
          settings: {
            theme: { colors: { primary: '#3787f6' }, logoUrl: null },
            plan: 'free',
          },
        },
      }),
    ]);
  }

  if (isPublicRequestOtpPost(req)) {
    const slug = getPublicSlugFromUrl(req.url);
    if (!slug) return next(req);
    return from([new HttpResponse({ status: 200, body: { ok: true } })]);
  }

  if (isPublicVerifyOtpPost(req)) {
    const slug = getPublicSlugFromUrl(req.url);
    if (!slug) return next(req);
    const body = req.body as Record<string, unknown>;
    const phone = String(body['phone'] ?? '');
    const mockCustomerId = 'mock-public-customer-' + (phone || createMockId()).slice(-6);
    const businessId = MOCK_BUSINESSES.find((b) => String(b['slug']) === slug)?.['_id'] ?? 'mock-business-1';
    const token = btoa(JSON.stringify({ customerId: mockCustomerId, businessId, role: 'client' }));
    return from([
      new HttpResponse({
        status: 200,
        body: { token, customerId: mockCustomerId, businessId: String(businessId) },
      }),
    ]);
  }

  if (isPublicAuthMeGet(req)) {
    const auth = req.headers.get('Authorization');
    if (!auth || !auth.startsWith('Bearer ')) {
      return from([
        new HttpResponse({
          status: 401,
          body: { message: 'Authentication required' },
        }),
      ]);
    }
    const token = auth.slice(7).trim();
    if (!token) {
      return from([
        new HttpResponse({
          status: 401,
          body: { message: 'Authentication required' },
        }),
      ]);
    }
    try {
      const payload = JSON.parse(atob(token)) as {
        customerId?: string;
        businessId?: string;
      };
      const customerId = String(payload.customerId ?? 'mock-public-customer');
      const businessId = String(payload.businessId ?? 'mock-business-1');
      const known = MOCK_BUSINESSES.find((b) => String(b['_id']) === businessId) as
        | Record<string, unknown>
        | undefined;
      const slug = known ? String(known['slug']) : 'demo-salon';
      return from([
        new HttpResponse({
          status: 200,
          body: {
            id: customerId,
            businessId,
            slug,
            name: 'לקוחה דמו',
            phone: '0500000000',
          },
        }),
      ]);
    } catch {
      return from([
        new HttpResponse({
          status: 401,
          body: { message: 'Authentication required' },
        }),
      ]);
    }
  }

  // ——— Public booking: GET business (full), GET landing bundle, GET services, GET availability, POST appointments ———
  if (isPublicBusinessesLandingGet(req)) {
    const slug = getPublicBusinessesSlugFromUrl(req.url);
    if (!slug) return next(req);
    const known = MOCK_BUSINESSES.find((b) => String(b['slug']) === slug) as
      | Record<string, unknown>
      | undefined;
    const name = known ? String(known['name']) : slug;
    return from([
      new HttpResponse({
        status: 200,
        body: {
          businessName: name,
          slug,
          heroSection: {
            businessName: name,
            tagline: 'יופי מקצועי, תוצאות מושלמות',
            description: '',
            heroImage: null,
            heroImageSecondary: null,
          },
          services: [],
          gallery: [],
          contact: { phone: '', whatsapp: '', email: '', location: '' },
          products: [],
          reviews: [],
          stats: { rating: 5, customersCount: 0, completedAppointmentsCount: 0 },
          sections: {
            hero: true,
            services: true,
            gallery: true,
            products: true,
            reviews: true,
            cta: true,
          },
          portfolioImageUrls: [],
        },
      }),
    ]);
  }

  if (isPublicBusinessesGet(req)) {
    const slug = getPublicBusinessesSlugFromUrl(req.url);
    if (!slug) return next(req);
    const known = MOCK_BUSINESSES.find((b) => String(b['slug']) === slug) as Record<string, unknown> | undefined;
    const id = known ? String(known['_id']) : 'mock-business-1';
    const name = known ? String(known['name']) : slug;
    const openingHours: Record<string, { open: string; close: string } | null> = {
      sun: { open: '09:00', close: '18:00' },
      mon: { open: '09:00', close: '18:00' },
      tue: { open: '09:00', close: '18:00' },
      wed: { open: '09:00', close: '18:00' },
      thu: { open: '09:00', close: '18:00' },
      fri: { open: '09:00', close: '14:00' },
      sat: null,
    };
    return from([
      new HttpResponse({
        status: 200,
        body: {
          id,
          name,
          openingHours,
          media: {
            photos: [
              'https://picsum.photos/800/400?random=1',
              'https://picsum.photos/800/400?random=2',
              'https://picsum.photos/800/400?random=3',
            ],
            videoUrl: undefined,
          },
          cancellationNoticeHe: 'יש להודיע מראש על ביטול התור. ביטול פחות מ-24 שעות מראש עשוי לחייב בתשלום.',
        },
      }),
    ]);
  }

  if (isPublicBusinessesServicesGet(req)) {
    const slug = getPublicBusinessesSlugFromUrl(req.url);
    if (!slug) return next(req);
    return from(loadInitialServices()).pipe(
      map((list) => {
        const active = list.filter((s) => s['isActive'] !== false);
        const body = active.map((s) => ({
          id: String(s['_id']),
          nameHe: String(s['name'] ?? s['nameHe'] ?? 'שירות'),
          durationMinutes: Number(s['durationMinutes'] ?? 30),
          price: s['price'] != null ? Number(s['price']) : undefined,
        }));
        return new HttpResponse({ status: 200, body });
      })
    );
  }

  if (isPublicBusinessesAvailabilityGet(req)) {
    const slug = getPublicBusinessesSlugFromUrl(req.url);
    const url = new URL(req.url, 'http://localhost');
    const serviceId = url.searchParams.get('serviceId') ?? '';
    const dateStr = url.searchParams.get('date') ?? '';
    if (!slug || !serviceId || !dateStr) return next(req);
    const slots = ['09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '12:00', '12:30', '14:00', '14:30', '15:00', '15:30', '16:00', '16:30', '17:00'];
    return from([new HttpResponse({ status: 200, body: { date: dateStr, slots } })]);
  }

  if (isPublicAppointmentsPost(req)) {
    const body = req.body as Record<string, unknown>;
    const id = createMockId();
    return from([
      new HttpResponse({
        status: 201,
        body: { id, status: 'confirmed' },
      }),
    ]);
  }

  // ——— Business settings (working hours: slots format) ———
  if (isBusinessSettingsPatch(req)) {
    const body = req.body as Record<string, unknown>;
    const wh = body['workingHours'] as Record<string, { enabled: boolean; slots: boolean[] }> | undefined;
    if (wh) {
      const next: Record<string, { enabled: boolean; slots: boolean[] }> = {};
      for (const k of WORKING_HOURS_DAY_KEYS) {
        const v = wh[k];
        if (v && Array.isArray(v.slots)) {
          next[k] = { enabled: !!v.enabled, slots: [...v.slots] };
        } else {
          next[k] = { enabled: DEFAULT_WORKING_HOURS[k].enabled, slots: [...DEFAULT_WORKING_HOURS[k].slots] };
        }
      }
      mockBusinessSettings = {
        ...mockBusinessSettings,
        theme: mockBusinessSettings?.theme ?? null,
        workingHours: next,
      };
    }
    return from([
      new HttpResponse({
        status: 200,
        body: { workingHours: mockBusinessSettings?.workingHours ?? buildDefaultWorkingHours() },
      }),
    ]);
  }

  return next(req);
};
