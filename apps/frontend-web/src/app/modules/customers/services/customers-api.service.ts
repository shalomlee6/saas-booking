import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import type { Customer } from '../model/customer';
import type { CreateCustomerDto } from '../dto/create-customer.dto';
import { ApiService } from '../../../core/api/api.service';

@Injectable({ providedIn: 'root' })
export class CustomersApiService {
  private readonly api = inject(ApiService);

  getList(search?: string): Observable<Customer[]> {
    const params = search ? `?search=${encodeURIComponent(search)}` : '';
    return this.api.get<Customer[]>(`customers${params}`);
  }

  create(dto: CreateCustomerDto): Observable<Customer> {
    return this.api.post<Customer>('customers', dto);
  }
}
