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

export type AdminPlanTier = 'free' | 'pro' | 'premium';

export interface AdminUserRow {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  role: string;
  status: string;
  businessId: string | null;
  businessName: string | null;
  /** Present when the user belongs to a business (normalized tier). */
  plan: AdminPlanTier | null;
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

export interface AdminOverviewDto {
  totalBusinesses: number;
  activeBusinesses: number;
  totalAppointments: number;
  appointmentsThisMonth: number;
  appointmentsLastMonth: number;
  monthOverMonthGrowthPercent: number;
  totalRevenue: number;
  newBusinessesThisMonth: number;
  newBusinessesLastMonth: number;
  businessesMonthOverMonthGrowthPercent: number;
  topPerformingBusiness: { name: string | null; bookingCount: number };
  avgBookingsPerBusiness: number;
  insights: string[];
  chartAppointmentsByMonth: { period: string; count: number }[];
}

export interface CreateAdminBusinessBody {
  businessName: string;
  ownerFullName: string;
  ownerEmail: string;
  ownerPhone?: string;
  plan: AdminPlanTier;
  timezone: string;
}

export interface CreateAdminBusinessResponse {
  business: {
    _id: string;
    name: string;
    slug: string;
    plan: AdminPlanTier;
    phone: string | null;
    ownerId: string;
    createdAt: string;
    updatedAt: string;
  } | null;
  owner: {
    id: string;
    email: string;
    name: string;
    phone: string | null;
    role: string;
    status: string;
    businessId: string | null;
    createdAt: string;
  } | null;
  settings: Record<string, unknown> | null;
  defaultService: Record<string, unknown> | null;
  credentialsSentVia: string;
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
    /** Present on API ≥ revenue metrics release; mock always sends them. */
    totalRevenue?: number;
    revenueLast30Days?: number;
    mrr?: number;
    arpu?: number;
    payingBusinesses?: number;
    newUserSignups: number;
    newBusinessesInRange: number;
    churnRiskBusinesses: number;
  };
  charts: {
    appointmentsByDay: { date: string; count: number }[];
    newBusinessesByWeek: { label: string; count: number }[];
    planDistribution: { plan: string; count: number }[];
    revenueByDay?: { date: string; amount: number }[];
  };
}

export type AdminAlertSeverity = 'info' | 'warning' | 'error';

export interface AdminAlertItem {
  id: string;
  severity: AdminAlertSeverity;
  category: string;
  title: string;
  message: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export interface AdminAlertsResponse {
  items: AdminAlertItem[];
  activeCount: number;
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

  getOverview(): Observable<AdminOverviewDto> {
    return this.api.get<AdminOverviewDto>('admin/overview');
  }

  createBusiness(body: CreateAdminBusinessBody): Observable<CreateAdminBusinessResponse> {
    return this.api.post<CreateAdminBusinessResponse>('admin/businesses', body);
  }

  getUser(id: string): Observable<AdminUserDetail> {
    return this.api.get<AdminUserDetail>(`admin/users/${id}`);
  }

  patchUser(id: string, body: { status?: 'active' | 'disabled'; name?: string }): Observable<AdminUserRow> {
    return this.api.patch<AdminUserRow>(`admin/users/${id}`, body);
  }

  deleteUser(id: string): Observable<void> {
    return this.api.delete<void>(`admin/users/${id}`);
  }

  getSettings(): Observable<PlatformSettingsDto> {
    return this.api.get<PlatformSettingsDto>('admin/settings');
  }

  patchSettings(body: Partial<PlatformSettingsDto>): Observable<PlatformSettingsDto> {
    return this.api.patch<PlatformSettingsDto>('admin/settings', body);
  }

  getAnalytics(
    range: '7d' | '30d' | '90d' | 'custom',
    custom?: { from: string; to: string }
  ): Observable<AdminAnalyticsDto> {
    const params: ApiQueryParams =
      range === 'custom' && custom
        ? { range: 'custom', from: custom.from, to: custom.to }
        : { range };
    return this.api.get<AdminAnalyticsDto>('admin/analytics', params);
  }

  getAlerts(): Observable<AdminAlertsResponse> {
    return this.api.get<AdminAlertsResponse>('admin/alerts');
  }

  getAlertsCount(): Observable<{ count: number }> {
    return this.api.get<{ count: number }>('admin/alerts/count');
  }

  dismissAlert(id: string): Observable<{ ok: boolean; activeCount: number }> {
    return this.api.patch<{ ok: boolean; activeCount: number }>(`admin/alerts/${id}/dismiss`, {});
  }

  resolveAlert(id: string): Observable<{ ok: boolean; activeCount: number }> {
    return this.api.patch<{ ok: boolean; activeCount: number }>(`admin/alerts/${id}/resolve`, {});
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
