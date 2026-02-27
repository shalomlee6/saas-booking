import { Injectable, inject } from '@angular/core';
import { Observable, of } from 'rxjs';
import { delay } from 'rxjs/operators';
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

/** Booking page: business details with opening hours and cancellation notice */
export interface PublicBusinessForBooking {
  id: string;
  name: string;
  openingHours: Record<string, { open: string; close: string } | null>;
  media: { photos: string[]; videoUrl?: string };
  cancellationNoticeHe: string;
}

export interface PublicService {
  id: string;
  nameHe: string;
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
}

export interface CreateAppointmentResponse {
  id: string;
  status: string;
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
}

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
      };
      return of(mock).pipe(delay(400));
    }
    return this.api.get<PublicBusinessForBooking>(
      `public/businesses/${encodeURIComponent(slug)}`
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
}
