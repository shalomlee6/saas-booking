import {
  HttpInterceptorFn,
  HttpRequest,
  HttpResponse,
} from '@angular/common/http';
import { from, map } from 'rxjs';
import { environment } from '../../../environments/environment';

/** In-memory session store for appointments created during mock mode. */
const sessionCreated: Record<string, unknown>[] = [];

/** Cached initial list from assets (loaded once per session). */
let initialAppointments: Record<string, unknown>[] | null = null;

function isAppointmentsGet(req: HttpRequest<unknown>): boolean {
  return req.method === 'GET' && req.url.includes('/api/appointments');
}

function isAppointmentsPost(req: HttpRequest<unknown>): boolean {
  return req.method === 'POST' && req.url.includes('/api/appointments');
}

function loadInitialList(): Promise<Record<string, unknown>[]> {
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

function createMockId(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(12)))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export const mockApiInterceptor: HttpInterceptorFn = (req, next) => {
  if (!environment.useMocks) {
    return next(req);
  }

  if (isAppointmentsGet(req)) {
    return from(loadInitialList()).pipe(
      map((list) => {
        const merged = [...list, ...sessionCreated];
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
    sessionCreated.push(created);
    return from([new HttpResponse({ status: 201, body: created })]);
  }

  return next(req);
};
