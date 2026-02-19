import { api } from './client';
import type { Customer } from '../types/api-types';

export async function fetchCustomers(): Promise<Customer[]> {
  const res = await api.get('/customers');
  return res.data;
}

export async function createCustomer(data: Partial<Customer>) {
  const res = await api.post('/customers', data);
  return res.data;
}
