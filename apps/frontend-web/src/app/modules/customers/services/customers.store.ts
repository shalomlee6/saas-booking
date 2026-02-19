import { Injectable, signal, inject } from '@angular/core';
import type { Customer } from '../model/customer';
import { CustomersApiService } from './customers-api.service';

@Injectable({ providedIn: 'root' })
export class CustomersStore {
  private readonly api = inject(CustomersApiService);

  readonly list = signal<Customer[]>([]);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  load(search?: string): void {
    this.loading.set(true);
    this.error.set(null);
    this.api.getList(search).subscribe({
      next: (customers) => {
        this.list.set(customers);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err?.error?.message || 'Failed to load customers');
        this.loading.set(false);
      },
    });
  }
}
