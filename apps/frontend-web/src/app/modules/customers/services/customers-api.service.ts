import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import type { Customer } from '../model/customer';
import type { CreateCustomerDto } from '../dto/create-customer.dto';
import type { UpdateCustomerDto } from '../dto/update-customer.dto';
import type { CustomerAppointmentHistoryItem, CustomerCardStatsResponse } from '../model/customer-card';
import { ApiService } from '../../../core/api/api.service';
import type { DataListPage, DataListQuery } from '../../../shared/data-management/entity-data-management-config';
import type { CustomerListRow } from '../model/customer-list-row';
import type { BookingOverride, NoShowControl } from '../model/no-show-control';

@Injectable({ providedIn: 'root' })
export class CustomersApiService {
  private readonly api = inject(ApiService);

  listPage(query: DataListQuery): Observable<DataListPage<CustomerListRow>> {
    return this.api.get<DataListPage<CustomerListRow>>('customers', {
      page: query.page,
      limit: query.limit,
      search: query.search,
      sort: query.sort,
      order: query.order,
      ...query.filters,
    });
  }

  exportCsv(query: DataListQuery): Observable<string> {
    return this.api.getText('customers/export', {
      page: query.page,
      limit: query.limit,
      search: query.search,
      sort: query.sort,
      order: query.order,
      ...query.filters,
    });
  }

  getNoShowControl(id: string): Observable<NoShowControl> {
    return this.api.get<NoShowControl>(`customers/${id}/no-show-control`);
  }

  excuseAllNoShows(id: string, reason?: string): Observable<NoShowControl & { excused: number }> {
    return this.api.post<NoShowControl & { excused: number }>(`customers/${id}/no-shows/excuse-all`, {
      ...(reason ? { reason } : {}),
    });
  }

  setNoShowExcused(
    id: string,
    appointmentId: string,
    excused: boolean,
    reason?: string
  ): Observable<NoShowControl> {
    return this.api.post<NoShowControl>(`customers/${id}/no-shows/${appointmentId}`, {
      excused,
      ...(reason ? { reason } : {}),
    });
  }

  setBookingOverride(id: string, override: BookingOverride, reason?: string): Observable<NoShowControl> {
    return this.api.patch<NoShowControl>(`customers/${id}/booking-override`, {
      override,
      ...(reason ? { reason } : {}),
    });
  }

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

  bulkSetStatus(ids: string[], isActive: boolean): Observable<{ updated: number }> {
    return this.api.post<{ updated: number }>('customers/bulk-status', { ids, isActive });
  }

  getNoShowPolicy(): Observable<NoShowPolicy> {
    return this.api.get<NoShowPolicy>('customers/no-show-policy');
  }

  updateNoShowPolicy(policy: NoShowPolicy): Observable<NoShowPolicy> {
    return this.api.put<NoShowPolicy>('customers/no-show-policy', policy);
  }
}

export interface NoShowPolicy {
  enabled: boolean;
  threshold: number;
}

export interface BulkDeleteCustomersResponse {
  deleted: string[];
  blocked: { id: string; name: string }[];
}
