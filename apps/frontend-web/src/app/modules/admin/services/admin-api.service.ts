import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '../../../core/api/api.service';
import type { BusinessUi } from '../../../core/config/theme.service';

export interface AdminBusiness {
  _id: string;
  name: string;
  slug: string;
  ownerEmail?: string | null;
  ownerPhone?: string | null;
  createdAt: string;
  updatedAt: string;
  ui?: BusinessUi;
}

export interface ImpersonateResponse {
  token: string;
  impersonatingBusinessId: string;
}

const IMPERSONATION_TOKEN_KEY = 'sb_impersonation_token';
const IMPERSONATION_BUSINESS_ID_KEY = 'sb_impersonation_business_id';

@Injectable({ providedIn: 'root' })
export class AdminApiService {
  private readonly api = inject(ApiService);

  listBusinesses(): Observable<AdminBusiness[]> {
    return this.api.get<AdminBusiness[]>('admin/businesses');
  }

  impersonateBusiness(businessId: string): Observable<ImpersonateResponse> {
    return this.api.post<ImpersonateResponse>('admin/impersonate', { businessId });
  }

  stopImpersonation(): Observable<{ ok: boolean }> {
    return this.api.post<{ ok: boolean }>('admin/stop-impersonate', {});
  }

  updateBusinessUi(businessId: string, ui: Partial<BusinessUi>): Observable<{ ui: BusinessUi }> {
    return this.api.patch<{ ui: BusinessUi }>(`admin/businesses/${businessId}/ui`, ui);
  }
}

export function getImpersonationToken(): string | null {
  return localStorage.getItem(IMPERSONATION_TOKEN_KEY);
}

/** Store impersonation token and optional business id (for AuthService.impersonatingBusinessId()). */
export function setImpersonationToken(token: string, impersonatingBusinessId?: string): void {
  localStorage.setItem(IMPERSONATION_TOKEN_KEY, token);
  if (impersonatingBusinessId != null) {
    localStorage.setItem(IMPERSONATION_BUSINESS_ID_KEY, impersonatingBusinessId);
  }
}

/** Clear impersonation token and business id; call AuthService.init() after. */
export function clearImpersonationToken(): void {
  localStorage.removeItem(IMPERSONATION_TOKEN_KEY);
  localStorage.removeItem(IMPERSONATION_BUSINESS_ID_KEY);
}

/** Prefer AuthService.isImpersonating() for app code. */
export function isImpersonating(): boolean {
  return !!localStorage.getItem(IMPERSONATION_TOKEN_KEY);
}
