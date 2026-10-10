import { Injectable, inject } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, delay, map, switchMap } from 'rxjs/operators';
import { ApiService } from '../../../core/api/api.service';
import { environment } from '../../../../environments/environment';
import type { BirthdayField, IdentityMode, PublicClientProfile } from './public-identity.rules';
import {
  mockIdentifyComplete,
  mockIdentifyStart,
  mockIdentifyVerify,
  mockCancelUpcoming,
  mockLogout,
  mockOffer,
  mockPublicConfig,
  mockRescheduleUpcoming,
  mockSessionMe,
  mockUpcomingAppointment,
} from './public-identity.mock-state';

export interface PublicBusiness {
  businessId: string;
  name: string;
  slug: string;
  settings?: {
    theme?: {
      /** Theme preset id (see `core/theming/theme-presets.ts`); resolved client-side. */
      preset?: string;
      /** Business-configured default light/dark mode; the customer's own explicit
       *  choice (stored client-side) always takes priority over this. */
      defaultMode?: 'light' | 'dark';
      logoUrl?: string;
    };
    plan?: string;
  };
}

/** Stats strip on public landing (from GET /api/public/businesses/:slug → landing.stats). */
export interface PublicLandingStats {
  rating: number;
  customersCount: number;
  completedAppointmentsCount: number;
}

export interface PublicLandingReviewItem {
  customerName: string;
  text: string;
  rating: number;
  date: string;
}

export interface PublicLandingProductItem {
  name: string;
  description: string;
  price: number;
}

export interface PublicLandingGalleryItem {
  id: string;
  imageUrl: string;
  title?: string;
  type: 'product' | 'service';
}

export interface PublicLandingContact {
  whatsapp?: string;
  email?: string;
  location?: string;
}

export interface PublicLandingSectionVisibility {
  hero?: boolean;
  services?: boolean;
  gallery?: boolean;
  products?: boolean;
  reviews?: boolean;
  cta?: boolean;
}

/** Extended payload on public business for booking (landing marketing sections). */
export interface PublicLandingPayload {
  tagline: string;
  coverImageUrl: string | null;
  phone: string | null;
  /** Longer hero copy under the tagline. */
  heroDescription?: string;
  /** Second hero / feature image (URL). */
  secondaryHeroImageUrl?: string | null;
  galleryItems?: PublicLandingGalleryItem[];
  contact?: PublicLandingContact;
  sectionVisibility?: PublicLandingSectionVisibility;
  stats: PublicLandingStats;
  portfolioImages: string[];
  products: PublicLandingProductItem[];
  reviews: PublicLandingReviewItem[];
}

/** GET /api/public/businesses/:slug/landing — structured bundle for builder + public sync. */
export interface PublicLandingHeroSection {
  businessName: string;
  tagline: string;
  description: string;
  heroImage: string | null;
  heroImageSecondary: string | null;
}

export interface PublicLandingServiceRow {
  id: string;
  name: string;
  description: string;
  durationMinutes: number;
  price?: number;
}

export interface PublicBusinessLandingBundle {
  businessName: string;
  slug: string;
  heroSection: PublicLandingHeroSection;
  services: PublicLandingServiceRow[];
  gallery: PublicLandingGalleryItem[];
  contact: {
    phone: string;
    whatsapp: string;
    email: string;
    location: string;
  };
  products: PublicLandingProductItem[];
  reviews: PublicLandingReviewItem[];
  stats: PublicLandingStats;
  sections: PublicLandingSectionVisibility;
  portfolioImageUrls: string[];
}

/** Booking page: business details with opening hours and cancellation notice */
export interface PublicBusinessForBooking {
  id: string;
  name: string;
  openingHours: Record<string, { open: string; close: string } | null>;
  media: { photos: string[]; videoUrl?: string };
  cancellationNoticeHe: string;
  /** From GET /api/public/businesses/:slug — used for public booking date keys. */
  localization?: {
    timezone?: string;
    language?: string;
    currency?: string;
  };
  landing?: PublicLandingPayload;
}

export interface PublicService {
  id: string;
  nameHe: string;
  description?: string;
  durationMinutes: number;
  price?: number;
}

export interface AvailabilityResponse {
  date: string;
  slots: string[];
  durationMinutes?: number;
  price?: number;
}

export interface PublicConfig {
  identityMode: IdentityMode;
  birthdayField: BirthdayField;
}

export interface IdentifyStartResponse {
  status: 'known' | 'new' | 'blocked';
}

export type PublicSessionResult =
  | { kind: 'ok'; profile: PublicClientProfile }
  | { kind: 'unauthorized' }
  | { kind: 'error' };

export interface CreateAppointmentBody {
  businessId: string;
  serviceId: string;
  date: string;
  time: string;
  /** Required for guest booking; omitted when logged in (server uses JWT customer). */
  customerName?: string;
  customerPhone?: string;
}

export interface CreateAppointmentResponse {
  id: string;
  status: string;
  token?: string;
  customerId?: string;
  customerName?: string;
}

export interface UpcomingAppointment {
  id: string;
  date: string;   // YYYY-MM-DD
  time: string;   // HH:mm
  status: string;
  serviceName: string;
  serviceId?: string;
  /** Server decision from the business cancellation window. */
  canModify?: boolean;
}

export interface UpcomingAppointmentResponse {
  appointment: UpcomingAppointment | null;
  appointments?: UpcomingAppointment[];
  businessPhone?: string | null;
}

@Injectable({ providedIn: 'root' })
export class PublicApiService {
  private readonly api = inject(ApiService);

  /** GET /api/public/:businessSlug/business */
  getBusiness(businessSlug: string): Observable<PublicBusiness> {
    return this.api.get<PublicBusiness>(`public/${encodeURIComponent(businessSlug)}/business`);
  }

  /**
   * POST /api/public/auth/logout
   * Clears the server-side httpOnly session cookie. Best-effort: callers clear the
   * client-side session (localStorage token + signals) regardless of this call's outcome.
   */
  logoutPublicCustomer(slug: string): Observable<{ ok: boolean }> {
    if (environment.mockPublicApi) {
      mockLogout(slug);
      return of({ ok: true });
    }
    return this.api.post<{ ok: boolean }>('public/session/logout', {}, { slug });
  }

  getPublicConfig(slug: string): Observable<PublicConfig> {
    if (environment.mockPublicApi) {
      return of(mockPublicConfig()).pipe(delay(40));
    }
    return this.api.get<PublicConfig>(`public/businesses/${encodeURIComponent(slug)}/config`);
  }

  getSessionMe(slug: string): Observable<PublicSessionResult> {
    if (environment.mockPublicApi) {
      const profile = mockSessionMe(slug);
      if (!profile) return of({ kind: 'unauthorized' as const });
      return of({ kind: 'ok' as const, profile });
    }
    return this.api.get<PublicClientProfile>('public/session/me', { slug }).pipe(
      map((profile) => ({ kind: 'ok' as const, profile })),
      catchError((err: unknown) => {
        const status = err instanceof HttpErrorResponse ? err.status : 0;
        if (status === 401) return of({ kind: 'unauthorized' as const });
        return of({ kind: 'error' as const });
      })
    );
  }

  identifyStart(slug: string, phone: string): Observable<IdentifyStartResponse> {
    if (environment.mockPublicApi) {
      return of(mockIdentifyStart(slug, phone)).pipe(delay(80));
    }
    return this.api.post<IdentifyStartResponse>(
      `public/businesses/${encodeURIComponent(slug)}/identify/start`,
      { phone }
    );
  }

  identifyVerify(slug: string, phone: string, code: string): Observable<{ status: 'known' | 'new'; verified: boolean }> {
    if (environment.mockPublicApi) {
      const result = mockIdentifyVerify(slug, phone, code);
      if (!result.ok) {
        return new Observable((subscriber) => {
          subscriber.error(new HttpErrorResponse({ status: 400, error: { message: result.reason } }));
        });
      }
      return of({ status: result.status, verified: true as const }).pipe(delay(80));
    }
    return this.api.post<{ status: 'known' | 'new'; verified: boolean }>(
      `public/businesses/${encodeURIComponent(slug)}/identify/verify`,
      { phone, code }
    );
  }

  identifyComplete(
    slug: string,
    body: { name?: string; birthday?: { day: number; month: number } }
  ): Observable<PublicClientProfile> {
    if (environment.mockPublicApi) {
      const profile = mockIdentifyComplete(slug, body);
      if (!profile) {
        return new Observable((subscriber) => {
          subscriber.error(new HttpErrorResponse({ status: 401 }));
        });
      }
      return of(profile).pipe(delay(80));
    }
    return this.api
      .post<{ ok: boolean; needsBirthday: boolean }>(
        `public/businesses/${encodeURIComponent(slug)}/identify/complete`,
        body
      )
      .pipe(
        switchMap(() => this.getSessionMe(slug)),
        map((result) => {
          if (result.kind !== 'ok') {
            throw new HttpErrorResponse({ status: 401 });
          }
          return result.profile;
        })
      );
  }

  /** GET /api/public/businesses/:slug — for booking page (opening hours, media, cancellation) */
  getBusinessForBooking(slug: string): Observable<PublicBusinessForBooking> {
    if (environment.mockPublicApi) {
      const mock: PublicBusinessForBooking = {
        id: 'biz1',
        name: 'CHEN BEAUTY',
        openingHours: {
          sun: { open: '09:00', close: '17:00' },
          mon: { open: '09:00', close: '17:00' },
          tue: { open: '09:00', close: '17:00' },
          wed: { open: '09:00', close: '17:00' },
          thu: { open: '09:00', close: '17:00' },
          fri: null,
          sat: null,
        },
        media: {
          photos: [
            'https://picsum.photos/800/400?random=1',
            'https://picsum.photos/800/400?random=2',
            'https://picsum.photos/800/400?random=3',
          ],
        },
        cancellationNoticeHe:
          'יש להודיע מראש על ביטול התור. ביטול פחות מ-24 שעות מראש עשוי לחייב בתשלום.',
        localization: { timezone: 'Asia/Jerusalem', language: 'he', currency: 'ILS' },
        landing: {
          tagline: 'יופי מקצועי, תוצאות מושלמות',
          coverImageUrl: null,
          phone: '050-1234567',
          heroDescription: '',
          secondaryHeroImageUrl: null,
          galleryItems: [],
          contact: {},
          sectionVisibility: {
            hero: true,
            services: true,
            gallery: true,
            products: true,
            reviews: true,
            cta: true,
          },
          stats: { rating: 4.9, customersCount: 128, completedAppointmentsCount: 900 },
          portfolioImages: [],
          products: [
            {
              name: 'לק ג׳ל פרימיום',
              description: 'עמידות ארוכה וברק מושלם',
              price: 180,
            },
          ],
          reviews: [
            {
              customerName: 'מיכל',
              text: 'שירות מקסים ומקצועי, חזרתי שוב!',
              rating: 5,
              date: '2026-03-01',
            },
          ],
        },
      };
      return of(mock).pipe(delay(400));
    }
    return this.api.get<PublicBusinessForBooking>(
      `public/businesses/${encodeURIComponent(slug)}`
    );
  }

  /** GET /api/public/businesses/:slug/landing — full structured landing (no-store on server). */
  getBusinessLanding(slug: string): Observable<PublicBusinessLandingBundle> {
    if (environment.mockPublicApi) {
      return this.getBusinessForBooking(slug).pipe(
        map((b) => ({
          businessName: b.name,
          slug,
          heroSection: {
            businessName: b.name,
            tagline: b.landing?.tagline ?? '',
            description: b.landing?.heroDescription ?? '',
            heroImage: b.landing?.coverImageUrl ?? null,
            heroImageSecondary: b.landing?.secondaryHeroImageUrl ?? null,
          },
          services: [],
          gallery: b.landing?.galleryItems ?? [],
          contact: {
            phone: b.landing?.phone ?? '',
            whatsapp: b.landing?.contact?.whatsapp ?? '',
            email: b.landing?.contact?.email ?? '',
            location: b.landing?.contact?.location ?? '',
          },
          products: b.landing?.products ?? [],
          reviews: b.landing?.reviews ?? [],
          stats: b.landing?.stats ?? {
            rating: 5,
            customersCount: 0,
            completedAppointmentsCount: 0,
          },
          sections: b.landing?.sectionVisibility ?? {},
          portfolioImageUrls: b.landing?.portfolioImages ?? [],
        }))
      );
    }
    return this.api.get<PublicBusinessLandingBundle>(
      `public/businesses/${encodeURIComponent(slug)}/landing`
    );
  }

  /** GET /api/public/businesses/:slug/services */
  getServices(slug: string): Observable<PublicService[]> {
    if (environment.mockPublicApi) {
      const mock: PublicService[] = [
        { id: 's1', nameHe: 'מניקור', durationMinutes: 30, price: 50 },
        { id: 's2', nameHe: 'פדיקור', durationMinutes: 45, price: 70 },
        { id: 's3', nameHe: 'ציפורניים', durationMinutes: 60, price: 90 },
      ];
      return of(mock).pipe(delay(300));
    }
    return this.api.get<PublicService[]>(
      `public/businesses/${encodeURIComponent(slug)}/services`
    );
  }

  /** GET /api/public/businesses/:slug/availability?serviceId=...&date=YYYY-MM-DD (legacy slug-based) */
  getAvailability(
    slug: string,
    serviceId: string,
    date: string
  ): Observable<AvailabilityResponse> {
    if (environment.mockPublicApi) {
      const offer = mockOffer();
      const mock: AvailabilityResponse = {
        date,
        slots: ['09:00', '11:00', '12:30', '14:00', '15:00', '16:00'],
        durationMinutes: offer.durationMinutes,
        price: offer.price,
      };
      return of(mock).pipe(delay(350));
    }
    const params = new URLSearchParams({ serviceId, date });
    return this.api.get<AvailabilityResponse>(
      `public/businesses/${encodeURIComponent(slug)}/availability?${params}`
    );
  }

  /** GET /api/public/availability?businessId=...&serviceId=...&date=YYYY-MM-DD — real availability from backend */
  getAvailabilityByBusinessId(
    businessId: string,
    serviceId: string,
    date: string,
    excludeAppointmentId?: string
  ): Observable<AvailabilityResponse> {
    if (environment.mockPublicApi) {
      const offer = mockOffer();
      const mock: AvailabilityResponse = {
        date,
        slots: ['09:00', '11:00', '12:30', '14:00', '15:00', '16:00'],
        durationMinutes: offer.durationMinutes,
        price: offer.price,
      };
      return of(mock).pipe(delay(350));
    }
    const params = new URLSearchParams({ businessId, serviceId, date });
    if (excludeAppointmentId) params.set('excludeAppointmentId', excludeAppointmentId);
    return this.api.get<AvailabilityResponse>(`public/availability?${params}`);
  }

  /** POST /api/public/appointments */
  createAppointment(body: CreateAppointmentBody): Observable<CreateAppointmentResponse> {
    if (environment.mockPublicApi) {
      return of({ id: 'apt1', status: 'confirmed', customerId: 'mock-customer' }).pipe(delay(200));
    }
    return this.api.post<CreateAppointmentResponse>('public/appointments', body);
  }

  rescheduleAppointment(
    appointmentId: string,
    date: string,
    time: string
  ): Observable<CreateAppointmentResponse & { date?: string; time?: string; serviceName?: string; serviceId?: string }> {
    if (environment.mockPublicApi) {
      const next = mockRescheduleUpcoming(appointmentId, date, time);
      if (!next) {
        return new Observable((subscriber) => {
          subscriber.error(new HttpErrorResponse({ status: 409, error: { code: 'SLOT_TAKEN' } }));
        });
      }
      return of({
        id: next.id,
        status: next.status,
        customerId: 'mock-customer',
        date: next.date,
        time: next.time,
        serviceName: next.serviceName,
        serviceId: next.serviceId,
      }).pipe(delay(200));
    }
    return this.api.post(`public/appointments/${encodeURIComponent(appointmentId)}/reschedule`, {
      date,
      time,
    });
  }

  /**
   * GET /api/public/appointments/upcoming
   * Returns the authenticated customer's upcoming non-cancelled appointments,
   * sorted soonest-first. `appointment` is the nearest item for the home preview.
   */
  getUpcomingAppointment(): Observable<UpcomingAppointmentResponse> {
    if (environment.mockPublicApi) {
      return of(mockUpcomingAppointment()).pipe(delay(80));
    }
    return this.api.get<UpcomingAppointmentResponse>('public/appointments/upcoming');
  }

  /**
   * DELETE /api/public/appointments/:appointmentId
   * Cancels the authenticated customer's own appointment.
   * Requires a non-empty cancellationReason.
   */
  cancelAppointment(
    appointmentId: string,
    cancellationReason: string
  ): Observable<{ ok: boolean }> {
    if (environment.mockPublicApi) {
      const ok = mockCancelUpcoming(appointmentId);
      if (!ok) {
        return new Observable((subscriber) => {
          subscriber.error(new HttpErrorResponse({ status: 409 }));
        });
      }
      return of({ ok: true }).pipe(delay(80));
    }
    return this.api.deleteWithBody<{ ok: boolean }>(
      `public/appointments/${encodeURIComponent(appointmentId)}`,
      { cancellationReason }
    );
  }
}
