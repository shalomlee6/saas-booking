import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService, type ApiQueryParams } from '../../../core/api/api.service';
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

export interface AdminUserRow {
  id: string;
  email: string;
  name: string;
  role: string;
  status: string;
  businessId: string | null;
  businessName: string | null;
  createdAt: string;
  lastLoginAt: string | null;
}

export interface AdminUsersPage {
  items: AdminUserRow[];
  total: number;
  page: number;
  limit: number;
}

export interface AdminUserDetail extends AdminUserRow {
  updatedAt?: string;
}

export interface PlatformSettingsDto {
  defaultTrialDurationDays: number;
  maintenanceMode: boolean;
  featureFlags: Record<string, boolean>;
  platformDisplayName: string;
  emailConfigurationNote: string;
  updatedAt?: string;
}

export interface AdminAnalyticsDto {
  rangeDays: number;
  totals: {
    businesses: number;
    activeBusinesses: number;
    users: number;
    appointments: number;
    appointmentsInRange: number;
    revenueInRange: number;
    newUserSignups: number;
    newBusinessesInRange: number;
    churnRiskBusinesses: number;
  };
  charts: {
    appointmentsByDay: { date: string; count: number }[];
    newBusinessesByWeek: { label: string; count: number }[];
    planDistribution: { plan: string; count: number }[];
  };
}

export interface AdminAuditRow {
  id: string;
  timestamp: string;
  actor: string;
  action: string;
  entity: string;
  entityId: string;
  metadata: Record<string, unknown>;
}

export interface AdminAuditPage {
  items: AdminAuditRow[];
  total: number;
  page: number;
  limit: number;
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

  listUsers(query: ApiQueryParams): Observable<AdminUsersPage> {
    return this.api.get<AdminUsersPage>('admin/users', query);
  }

  getUser(id: string): Observable<AdminUserDetail> {
    return this.api.get<AdminUserDetail>(`admin/users/${id}`);
  }

  patchUser(id: string, body: { status?: 'active' | 'disabled'; name?: string }): Observable<AdminUserRow> {
    return this.api.patch<AdminUserRow>(`admin/users/${id}`, body);
  }

  getSettings(): Observable<PlatformSettingsDto> {
    return this.api.get<PlatformSettingsDto>('admin/settings');
  }

  patchSettings(body: Partial<PlatformSettingsDto>): Observable<PlatformSettingsDto> {
    return this.api.patch<PlatformSettingsDto>('admin/settings', body);
  }

  getAnalytics(range: '7d' | '30d' | '90d'): Observable<AdminAnalyticsDto> {
    return this.api.get<AdminAnalyticsDto>('admin/analytics', { range });
  }

  listAudit(query: ApiQueryParams): Observable<AdminAuditPage> {
    return this.api.get<AdminAuditPage>('admin/audit', query);
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
