import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '../../../core/api/api.service';


export interface PublicBusiness {
  businessId: string;
  name: string;
  slug: string;
  settings?: {
    theme?: { colors?: { primary?: string }; logoUrl?: string };
    plan?: string;
  };
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
}
