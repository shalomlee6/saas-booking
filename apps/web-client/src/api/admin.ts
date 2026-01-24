import { api } from './client';

export interface AdminBusiness {
  _id: string;
  name: string;
  slug: string;
  createdAt: string;
  updatedAt: string;
  settings: {
    plan: string;
    theme: {
      colors: {
        primary: string;
      };
    };
    features: {
      bookingEnabled: boolean;
    };
  };
}

export async function getAdminBusinesses(): Promise<AdminBusiness[]> {
  const res = await api.get<AdminBusiness[]>('/admin/businesses');
  return res.data;
}

export async function createAdminBusiness(name: string): Promise<AdminBusiness> {
  const res = await api.post<AdminBusiness>('/admin/businesses', { name });
  return res.data;
}

export interface ImpersonateResponse {
  token: string;
  impersonatingBusinessId: string;
}

export async function adminImpersonate(businessId: string): Promise<ImpersonateResponse> {
  const res = await api.post<ImpersonateResponse>('/admin/impersonate', { businessId });
  return res.data;
}

export async function adminStopImpersonate(): Promise<{ ok: boolean }> {
  const res = await api.post<{ ok: boolean }>('/admin/stop-impersonate');
  return res.data;
}





