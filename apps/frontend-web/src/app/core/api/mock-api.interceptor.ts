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

function isAppointmentsGet(req: HttpRequest<unknown>): boolean {
  return req.method === 'GET' && req.url.includes('/api/appointments');
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

function isBusinessSettingsPatch(req: HttpRequest<unknown>): boolean {
  return req.method === 'PATCH' && req.url.includes('/api/business/settings');
}

function isAdminBusinessesGet(req: HttpRequest<unknown>): boolean {
  return req.method === 'GET' && req.url.includes('/api/admin/businesses');
}

function isAdminImpersonatePost(req: HttpRequest<unknown>): boolean {
  return req.method === 'POST' && req.url.includes('/api/admin/impersonate');
}

function isAdminStopImpersonatePost(req: HttpRequest<unknown>): boolean {
  return req.method === 'POST' && req.url.includes('/api/admin/stop-impersonate');
}

function isPublicBusinessGet(req: HttpRequest<unknown>): boolean {
  return req.method === 'GET' && /\/api\/public\/[^/]+\/business\/?(\?|$)/.test(req.url);
}

function isPublicRequestOtpPost(req: HttpRequest<unknown>): boolean {
  return req.method === 'POST' && /\/api\/public\/[^/]+\/auth\/request-otp/.test(req.url);
}

function isPublicVerifyOtpPost(req: HttpRequest<unknown>): boolean {
  return req.method === 'POST' && /\/api\/public\/[^/]+\/auth\/verify-otp/.test(req.url);
}

function getPublicSlugFromUrl(url: string): string | null {
  const m = url.match(/\/api\/public\/([^/]+)\//);
  return m ? m[1] : null;
}

function isPublicBusinessesGet(req: HttpRequest<unknown>): boolean {
  return req.method === 'GET' && /\/api\/public\/businesses\/[^/]+\/?(\?|$)/.test(req.url);
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

const MOCK_BUSINESSES: Record<string, unknown>[] = [
  {
    _id: 'mock-business-1',
    name: 'Demo Salon',
    slug: 'demo-salon',
    ownerEmail: 'owner@example.com',
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-01-01T00:00:00.000Z',
    ui: { themeMode: 'light' },
  },
  {
    _id: 'mock-business-2',
    name: 'Second Salon',
    slug: 'second-salon',
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

  // ——— Appointments ———
  if (isAppointmentsGet(req)) {
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

  // ——— Auth: login sets mockCurrentUser; auth/me uses Bearer or mockCurrentUser ———
  if (isAuthLoginPost(req)) {
    const body = req.body as Record<string, unknown>;
    const email = String(body['email'] ?? '').toLowerCase();
    if (email === 'superadmin@example.com') {
      mockCurrentUser = { role: 'super_admin' };
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
    return from([new HttpResponse({ status: 200, body: mockAuthMeResponse(req) })]);
  }

  // ——— Admin: businesses list, impersonate, stop-impersonate ———
  if (isAdminBusinessesGet(req)) {
    return from([new HttpResponse({ status: 200, body: [...MOCK_BUSINESSES] })]);
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

  // ——— Public booking: GET business (full), GET services, GET availability, POST appointments ———
  if (isPublicBusinessesGet(req) && !req.url.includes('/services') && !req.url.includes('/availability')) {
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
