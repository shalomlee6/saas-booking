import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '../../../core/api/api.service';
import type {
  CreateCustomerServiceConfigDto,
  CustomerServiceConfig,
  UpdateCustomerServiceConfigDto,
} from '../model/customer-service-config';

@Injectable({ providedIn: 'root' })
export class CustomerServiceConfigApiService {
  private readonly api = inject(ApiService);

  listForCustomer(customerId: string): Observable<CustomerServiceConfig[]> {
    return this.api.get<CustomerServiceConfig[]>('customer-service-configs', { customerId });
  }

  create(dto: CreateCustomerServiceConfigDto): Observable<CustomerServiceConfig> {
    return this.api.post<CustomerServiceConfig>('customer-service-configs', dto);
  }

  update(id: string, dto: UpdateCustomerServiceConfigDto): Observable<CustomerServiceConfig> {
    return this.api.put<CustomerServiceConfig>(`customer-service-configs/${id}`, dto);
  }

  delete(id: string): Observable<{ ok: boolean }> {
    return this.api.delete<{ ok: boolean }>(`customer-service-configs/${id}`);
  }
}
