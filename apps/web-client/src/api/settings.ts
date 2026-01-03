import { api } from './client';
import type { BusinessSettingsDto } from '../types/api-types';

export async function getMySettings(): Promise<BusinessSettingsDto> {
  const res = await api.get<BusinessSettingsDto>('/settings/me/settings');
  return res.data;
}

export async function updateMySettings(payload: Partial<BusinessSettingsDto>): Promise<BusinessSettingsDto> {
  const res = await api.put<BusinessSettingsDto>('/settings/me/settings', payload);
  return res.data;
}

