import { Injectable, inject } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, delay, map } from 'rxjs/operators';
import { ApiService } from '../../../core/api/api.service';
import { environment } from '../../../../environments/environment';

export interface PublicBusiness {
  businessId: string;
  name: string;
  slug: string;
  settings?: {
    theme?: { colors?: { primary?: string }; logoUrl?: string };
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
}

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
}

export interface UpcomingAppointmentResponse {
  appointment: UpcomingAppointment | null;
}

export interface RequestOtpBody {
  phone: string;
  firstName?: string;
  lastName?: string;
}

export interface VerifyOtpBody {
  phone: string;
  code: string;
}

export interface VerifyOtpResponse {
  token: string;
  customerId: string;
  businessId: string;
  customerName?: string;
  customerPhone?: string;
}

/** GET /api/public/auth/me — authenticated public customer profile */
export interface PublicAuthMeResponse {
  id: string;
  businessId: string;
  slug: string;
  name?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  email?: string;
}

export type PublicAuthMeResult =
  | { kind: 'ok'; me: PublicAuthMeResponse }
  | { kind: 'unauthorized' }
  | { kind: 'error' };

@Injectable({ providedIn: 'root' })
export class PublicApiService {
  private readonly api = inject(ApiService);

  /** GET /api/public/:businessSlug/business */
  getBusiness(businessSlug: string): Observable<PublicBusiness> {
    return this.api.get<PublicBusiness>(`public/${encodeURIComponent(businessSlug)}/business`);
  }

  /** POST /api/public/:businessSlug/auth/request-otp */
  requestOtp(businessSlug: string, body: RequestOtpBody): Observable<{ ok: boolean }> {
    return this.api.post<{ ok: boolean }>(
      `public/${encodeURIComponent(businessSlug)}/auth/request-otp`,
      body
    );
  }

  /** POST /api/public/:businessSlug/auth/verify-otp */
  verifyOtp(businessSlug: string, body: VerifyOtpBody): Observable<VerifyOtpResponse> {
    return this.api.post<VerifyOtpResponse>(
      `public/${encodeURIComponent(businessSlug)}/auth/verify-otp`,
      body
    );
  }

  /**
   * GET /api/public/auth/me
   * Uses Bearer (sessionStorage) and/or HTTP-only cookie (withCredentials).
   */
  getPublicAuthMe(): Observable<PublicAuthMeResult> {
    return this.api.get<PublicAuthMeResponse>('public/auth/me').pipe(
      map((me) => ({ kind: 'ok' as const, me })),
      catchError((err: unknown) => {
        const status = err instanceof HttpErrorResponse ? err.status : 0;
        if (status === 401) {
          return of({ kind: 'unauthorized' as const });
        }
        return of({ kind: 'error' as const });
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
      const mock: AvailabilityResponse = {
        date,
        slots: ['09:00', '11:00', '12:30', '14:00', '15:00', '16:00'],
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
    date: string
  ): Observable<AvailabilityResponse> {
    if (environment.mockPublicApi) {
      const mock: AvailabilityResponse = {
        date,
        slots: ['09:00', '11:00', '12:30', '14:00', '15:00', '16:00'],
      };
      return of(mock).pipe(delay(350));
    }
    const params = new URLSearchParams({ businessId, serviceId, date });
    return this.api.get<AvailabilityResponse>(`public/availability?${params}`);
  }

  /** POST /api/public/appointments */
  createAppointment(body: CreateAppointmentBody): Observable<CreateAppointmentResponse> {
    if (environment.mockPublicApi) {
      return of({ id: 'apt1', status: 'confirmed' }).pipe(delay(800));
    }
    return this.api.post<CreateAppointmentResponse>('public/appointments', body);
  }

  /**
   * GET /api/public/appointments/upcoming
   * Returns the authenticated customer's nearest future non-cancelled appointment,
   * or { appointment: null } for guests or when none exists.
   */
  getUpcomingAppointment(): Observable<UpcomingAppointmentResponse> {
    if (environment.mockPublicApi) {
      // Return no appointment in mock mode.  Returning a hardcoded appointment
      // for every session regardless of identity would mask identity-isolation
      // bugs during development and testing.
      return of({ appointment: null }).pipe(delay(400));
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
      return of({ ok: true }).pipe(delay(600));
    }
    return this.api.deleteWithBody<{ ok: boolean }>(
      `public/appointments/${encodeURIComponent(appointmentId)}`,
      { cancellationReason }
    );
  }
}
