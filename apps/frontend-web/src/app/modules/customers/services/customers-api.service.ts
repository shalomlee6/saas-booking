import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import type { Customer } from '../model/customer';
import type { CreateCustomerDto } from '../dto/create-customer.dto';
import type { UpdateCustomerDto } from '../dto/update-customer.dto';
import type { CustomerAppointmentHistoryItem, CustomerCardStatsResponse } from '../model/customer-card';
import { ApiService } from '../../../core/api/api.service';

@Injectable({ providedIn: 'root' })
export class CustomersApiService {
  private readonly api = inject(ApiService);

  getList(search?: string): Observable<Customer[]> {
    const params = search ? `?search=${encodeURIComponent(search)}` : '';
    return this.api.get<Customer[]>(`customers${params}`);
  }

  getById(id: string): Observable<Customer> {
    return this.api.get<Customer>(`customers/${id}`);
  }

  create(dto: CreateCustomerDto): Observable<Customer> {
    return this.api.post<Customer>('customers', dto);
  }

  update(id: string, dto: UpdateCustomerDto): Observable<Customer> {
    return this.api.put<Customer>(`customers/${id}`, dto);
  }

  /** Full past+upcoming appointment history for the Client Card (not date-windowed). */
  getAppointmentHistory(id: string): Observable<CustomerAppointmentHistoryItem[]> {
    return this.api.get<CustomerAppointmentHistoryItem[]>(`customers/${id}/appointments`);
  }

  /** Auto-derived stats + rule-based insights, computed live from the Appointment collection. */
  getCardStats(id: string): Observable<CustomerCardStatsResponse> {
    return this.api.get<CustomerCardStatsResponse>(`customers/${id}/stats`);
  }

  /** Refused (409) when the customer has appointment history. */
  delete(id: string): Observable<{ ok: boolean }> {
    return this.api.delete<{ ok: boolean }>(`customers/${id}`);
  }

  /** Best-effort: customers with appointment history are skipped, not an all-or-nothing failure. */
  bulkDelete(ids: string[]): Observable<BulkDeleteCustomersResponse> {
    return this.api.post<BulkDeleteCustomersResponse>('customers/bulk-delete', { ids });
  }
}

export interface BulkDeleteCustomersResponse {
  deleted: string[];
  blocked: { id: string; name: string }[];
}
