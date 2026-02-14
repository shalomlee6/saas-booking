import {
  HttpInterceptorFn,
  HttpRequest,
  HttpResponse,
} from '@angular/common/http';
import { from, map } from 'rxjs';
import { environment } from '../../../environments/environment';

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

/** Mock auth/me: business owner so /services and layout work without backend. */
function mockAuthMeResponse(): AuthMeResponse {
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
    businessSettings: { theme: null },
  };
}

interface AuthMeResponse {
  user: { id: string; email: string; role: string; businessId?: string; businessSlug?: string };
  business?: { _id: string; name: string; slug: string; ownerEmail?: string | null; ui?: { themeMode?: string } } | null;
  businessSettings?: { theme: unknown } | null;
}

export const mockApiInterceptor: HttpInterceptorFn = (req, next) => {
  if (!environment.useMocks) {
    return next(req);
  }

  // ——— Appointments ———
  if (isAppointmentsGet(req)) {
    return from(loadInitialAppointments()).pipe(
      map((list) => {
        const merged = [...list, ...sessionCreatedAppointments];
        merged.sort((a, b) => {
          const aStart = String(a['start'] ?? '');
          const bStart = String(b['start'] ?? '');
          return aStart.localeCompare(bStart);
        });
        return new HttpResponse({ status: 200, body: merged });
      })
    );
  }

  if (isAppointmentsPost(req)) {
    const body = req.body as Record<string, unknown>;
    const now = new Date().toISOString();
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
    return from(loadInitialCustomers()).pipe(
      map((list) => new HttpResponse({ status: 200, body: [...list] }))
    );
  }

  // ——— Auth (mock so app loads without backend) ———
  if (isAuthMeGet(req)) {
    return from([new HttpResponse({ status: 200, body: mockAuthMeResponse() })]);
  }

  return next(req);
};
