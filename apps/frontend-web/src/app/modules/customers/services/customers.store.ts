import { Injectable, signal, inject } from '@angular/core';
import type { Customer } from '../model/customer';
import { CustomersApiService } from './customers-api.service';
import { LanguageService } from '../../../core/i18n/language.service';

@Injectable({ providedIn: 'root' })
export class CustomersStore {
  private readonly api = inject(CustomersApiService);
  private readonly language = inject(LanguageService);

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
      error: () => {
        this.error.set(this.language.t('customers.loadListError'));
        this.loading.set(false);
      },
    });
  }
}
