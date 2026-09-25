import type { CustomerPreferences } from '../model/customer';

export interface CreateCustomerDto {
  name: string;
  phone: string;
  email?: string;
  notes?: string;
  preferences?: CustomerPreferences;
}
