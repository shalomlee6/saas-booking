import type { CustomerPreferences } from '../model/customer';

export interface UpdateCustomerDto {
  name?: string;
  phone?: string;
  email?: string;
  notes?: string;
  preferences?: CustomerPreferences;
}
