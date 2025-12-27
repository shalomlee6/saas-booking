import axios from 'axios';

// Public API client (no auth by default, can add client token)
export const publicApi = axios.create({
  baseURL: 'http://localhost:5088/api/public',
  withCredentials: false,
});

// Interceptor to add client token if available
publicApi.interceptors.request.use((config) => {
  const token = localStorage.getItem('sb_client_token');
  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Public API functions
export async function getPublicBusiness(businessSlug: string) {
  const res = await publicApi.get(`/${businessSlug}/business`);
  return res.data;
}

export async function getPublicServices(businessSlug: string) {
  const res = await publicApi.get(`/${businessSlug}/services`);
  return res.data;
}

export async function getPublicAvailableSlots(
  businessSlug: string,
  serviceId: string,
  customerId: string,
  weekStart?: string
) {
  const params = new URLSearchParams({
    serviceId,
    customerId,
  });
  if (weekStart) {
    params.append('weekStart', weekStart);
  }
  const res = await publicApi.get(`/${businessSlug}/available-slots?${params.toString()}`);
  return res.data;
}

export async function createPublicAppointment(
  businessSlug: string,
  data: { serviceId: string; customerId: string; start: string; end: string }
) {
  const res = await publicApi.post(`/${businessSlug}/appointments`, data);
  return res.data;
}

export async function requestOtp(businessSlug: string, phone: string) {
  const res = await publicApi.post(`/${businessSlug}/auth/request-otp`, { phone });
  return res.data;
}

export async function verifyOtp(businessSlug: string, phone: string, code: string) {
  const res = await publicApi.post(`/${businessSlug}/auth/verify-otp`, { phone, code });
  return res.data;
}

